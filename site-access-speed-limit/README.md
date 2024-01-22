# Site-Access-Speed-Limit

通过 Lambda edge/Dynamodb 实现网站的低频限速访问，并把 Blocked IP 加回 WAF 的 Blocked IP Set。

## 角色信任关系

```markdown
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
```

## DynamoDB

```markdown
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

```

## License

This library is licensed under MIT-0 License. See the [LICENSE](LICENSE) file.
