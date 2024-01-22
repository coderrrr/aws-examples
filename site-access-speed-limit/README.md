# Site-Access-Speed-Limit

## 角色信任关系

<pre>
<code>
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": [
                    "lambda.amazonaws.com",
                    "edgelambda.amazonaws.com"
                ]
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
</code>
</pre>

<br>
## DynamoDB
<br>
<pre>
<code>
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
<br>
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

</code>
</pre>
## License
This library is licensed under MIT-0 License. See the [LICENSE](LICENSE) file.
