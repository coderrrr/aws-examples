import boto3
import time
import datetime

'''
角色信任关系：
"Principal": {
    "Service": [
        "lambda.amazonaws.com",
        "edgelambda.amazonaws.com"
    ]
}
"Action": "sts:AssumeRole"

DynamoDB：
创建 banned_ips 表，用于存放封禁IP清单，根据需要再重复创建其他区域的全局表
aws dynamodb create-table \
--table-name banned_ips \
--attribute-definitions AttributeName=ip,AttributeType=S \
--key-schema AttributeName=ip,KeyType=HASH \
--provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
--stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
--region us-east-1
创建全局表Group
aws dynamodb create-global-table \
    --global-table-name banned_ips \
    --replication-group RegionName=us-east-1 RegionName=region—name-n
    
创建 access_logs 表，用于存放必要的访问记录，根据需要再重复创建其他区域的全局表
aws dynamodb create-table \
    --table-name access_logs \--attribute-definitions \
        AttributeName=ip_uri,AttributeType=S \
        AttributeName=ts,AttributeType=N \
    --key-schema AttributeName=ip_uri,KeyType=HASH AttributeName=ts,KeyType=RANGE \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
    --region us-east-1
创建全局表Group
aws dynamodb create-global-table \
    --global-table-name access_logs \
    --replication-group RegionName=us-east-1 RegionName=region—name-n
'''

# 创建 需要限速的URL和次数字典以及限速窗口
rate_limits = {
    "/": 2,
    "/index.html": 2
}
DURATION_IN_SECONDS = 10

# 设置变量
ACCESS_LOG = 'access_logs'  # 存放访问日志
BANNED_IPS_TABLE = 'banned_ips'  # 存放封禁的IP清单

# 创建当前区域 DynamoDB 客户端
dynamodb = boto3.client("dynamodb")
# 创建 Global(CloudFront) WAF 客户端
waf_global = boto3.client('wafv2', region_name='us-east-1')

response = dynamodb.list_tables()
if ACCESS_LOG in response['TableNames']:
    print("DynamoDB table exists in current region")
else:
    print("DynamoDB table does not exist in current region, use us-east-1")
    dynamodb = boto3.client("dynamodb", region_name='us-east-1')

# 若指定为空字符串则不加入到 WAF IP Set里
IP_SET_ID = 'c35bdb9d-c22f-4e79-8eff-ae8588c494d6'
IP_SET_NAME = 'Blocked-IPs'


def lambda_handler(event, context):
    # 获取客户端 IP 和请求的 URL
    request = event["Records"][0]["cf"]["request"]
    uri = request["uri"]
    client_ip = request["clientIp"]

    # 检查客户端是否有权进行请求
    if is_rate_limited(client_ip, uri):
        # 如果客户端被禁止，则返回 HTTP 状态码 429
        return {
            "status": "429",
            "body": "Rate exceeded, too many requests",
        }

    # 返回请求
    return request


# 读取限制速率的 URL 和次数
def get_rate_limit(uri):
    return rate_limits.get(uri, 0)

# 检查客户端是否有权进行请求


def is_rate_limited(client_ip, uri):
    rate_limit = get_rate_limit(uri)
    # 检查客户端 IP 是否已经被禁止
    response = dynamodb.get_item(
        TableName=BANNED_IPS_TABLE,
        Key={"ip": {"S": client_ip}
             }
    )

    if "Item" in response:
        return True
    else:
        # 获取当前请求的 URL 的限制速率
        # 如果没有限制，则判断失败
        if rate_limit == 0:
            return False
        # 如果有限制，则进行计数
        else:
            # 添加一条访问记录并计算规定时间内的访问次数
            tsnow = int(datetime.datetime.utcnow().timestamp())
            response = dynamodb.put_item(
                TableName=ACCESS_LOG,
                Item={"ip_uri": {"S": client_ip+'_'+uri},
                      "ts": {"N": str(tsnow)}
                      }
            )
            timestamp_start = tsnow - DURATION_IN_SECONDS
            timestamp_end = tsnow
            num_requests = dynamodb.query(
                TableName=ACCESS_LOG,
                KeyConditionExpression="ip_uri = :pk and ts BETWEEN :start_timestamp AND :end_timestamp",
                ExpressionAttributeValues={
                    ":pk": {"S": client_ip+'_'+uri},
                    ":start_timestamp": {"N": str(timestamp_start)},
                    ":end_timestamp": {"N": str(timestamp_end)},
                }
            )["Count"]
            # 如果请求次数大于限制速率，则将客户端 IP 添加到禁止列表中
            if num_requests > rate_limit:

                if IP_SET_ID != '':
                    print('Adding [', client_ip, '] to WAF Blocked IP set...')
                    # 加入waf blocked ip set
                    waf_global.update_ip_set(
                        Name=IP_SET_NAME,
                        Scope='CLOUDFRONT',
                        Id=IP_SET_ID,
                        Addresses=[client_ip+'/32'],
                        LockToken=waf_global.get_ip_set(
                            Name=IP_SET_NAME, Scope='CLOUDFRONT', Id=IP_SET_ID)['LockToken']
                    )

                    dynamodb.put_item(
                        TableName=BANNED_IPS_TABLE,
                        Item={"ip": {"S": client_ip}, "ts": {"N": str(tsnow)}}
                    )

                    # Block后，删除访问记录以节省 DynamoDB 空间
                    access_logs = dynamodb.query(
                        TableName=ACCESS_LOG,
                        KeyConditionExpression="ip_uri = :pk",
                        ExpressionAttributeValues={
                            ":pk": {"S": client_ip+'_'+uri}
                        }
                    )
                    items_to_delete = {}
                    items_to_delete[ACCESS_LOG] = []
                    for item in access_logs['Items']:
                        items_to_delete[ACCESS_LOG].append({
                            'DeleteRequest': {
                                'Key': {'ip_uri': item['ip_uri'], 'ts': item['ts']}
                            }
                        })
                    dynamodb.batch_write_item(RequestItems=items_to_delete)
            return num_requests > rate_limit
