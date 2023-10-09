package main

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/ec2/types"
)

func main() {
	// 配置AWS SDK，使用您的AK/SK]
	AK := "AK********"
	SK := "**********"

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(AK, SK, "")),
	)
	if err != nil {
		fmt.Println("无法配置AWS SDK:", err)
		return
	}

	// 创建EC2服务客户端
	svc := ec2.NewFromConfig(cfg)

	// 定义实例配置
	instanceType := "t3.medium"
	ebsVolumeSize := 30              // 30GB
	securityGroupID := "sg-12345678" // 替换为您的安全组ID
	subnetID := "subnet-12345678"    // 替换为您的子网ID
	amiID := "ami-079cd5448deeace01" // 替换为您的AMI ID
	nameTag := "MyInstance"          // 实例的Name标签

	// 创建EC2实例
	runInput := &ec2.RunInstancesInput{
		MaxCount:     aws.Int32(1),
		MinCount:     aws.Int32(1),
		InstanceType: types.InstanceType(instanceType),
		BlockDeviceMappings: []types.BlockDeviceMapping{
			{
				DeviceName: aws.String("/dev/sda1"),
				Ebs: &types.EbsBlockDevice{
					VolumeSize: aws.Int32(int32(ebsVolumeSize)),
				},
			},
		},
		SubnetId:         aws.String(subnetID),
		SecurityGroupIds: []string{securityGroupID},
		ImageId:          aws.String(amiID),
		TagSpecifications: []types.TagSpecification{
			{
				ResourceType: types.ResourceTypeInstance,
				Tags: []types.Tag{
					{
						Key:   aws.String("Name"),
						Value: aws.String(nameTag),
					},
				},
			},
		},
	}

	runOutput, err := svc.RunInstances(context.TODO(), runInput)
	if err != nil {
		fmt.Println("无法创建EC2实例:", err)
		return
	}

	// 打印实例ID
	fmt.Println("创建的实例ID:")
	for _, instance := range runOutput.Instances {
		fmt.Println(*instance.InstanceId)
	}

	// 等待EC2实例状态变为"running"
	fmt.Println("等待EC2实例状态变为'running'...")
	instanceIds := []string{}
	for _, instance := range runOutput.Instances {
		instanceIds = append(instanceIds, *instance.InstanceId)
	}
	if err := waitForInstancesRunning(context.TODO(), svc, instanceIds); err != nil {
		fmt.Println("等待EC2实例状态变为'running'时出错:", err)
		return
	}

	// 为每个实例申请并绑定Elastic IP
	for _, instance := range runOutput.Instances {
		// 申请Elastic IP
		allocateOutput, err := svc.AllocateAddress(context.TODO(), &ec2.AllocateAddressInput{})
		if err != nil {
			fmt.Println("无法分配Elastic IP:", err)
			return
		}

		// 绑定Elastic IP到实例
		_, err = svc.AssociateAddress(context.TODO(), &ec2.AssociateAddressInput{
			InstanceId: instance.InstanceId,
			PublicIp:   allocateOutput.PublicIp,
		})

		if err != nil {
			fmt.Println("无法绑定Elastic IP到实例:", err)
			return
		}

		fmt.Printf("为实例 %s 绑定了Elastic IP %s\n", *instance.InstanceId, *allocateOutput.PublicIp)
	}

	// 查询符合条件的EC2
	queryEC2s(svc)
}

// 等待EC2实例状态变为"running"
func waitForInstancesRunning(ctx context.Context, svc *ec2.Client, instanceIds []string) error {
	for {
		describeInstancesOutput, err := svc.DescribeInstances(ctx, &ec2.DescribeInstancesInput{
			InstanceIds: instanceIds,
		})
		if err != nil {
			return err
		}

		allRunning := true
		for _, reservation := range describeInstancesOutput.Reservations {
			for _, instance := range reservation.Instances {
				if *&instance.State.Name != "running" {
					allRunning = false
					break
				}
			}
		}

		if allRunning {
			fmt.Println("所有EC2实例的状态已变为'running'")
			return nil
		}

		fmt.Println("等待中...")
		time.Sleep(10 * time.Second)
	}
}

// 根据 Tag 作为过滤条件查询EC2列表，获取EC2的Tag和Public IP
func queryEC2s(svc *ec2.Client) {
	// 定义要查询的Tag Name和Value
	tagName1 := "Name"        // 替换为您的第一个Tag Name
	tagValue1 := "MyInstance" // 替换为您的第一个Tag Value
	tagName2 := "Name"        // 替换为您的第二个Tag Name
	tagValue2 := "MyInstance" // 替换为您的第二个Tag Value

	// 构建Tag筛选条件
	tagFilter1 := types.Filter{
		Name:   aws.String("tag:" + tagName1),
		Values: []string{tagValue1},
	}

	tagFilter2 := types.Filter{
		Name:   aws.String("tag:" + tagName2),
		Values: []string{tagValue2},
	}

	// 构建EC2实例筛选条件
	instanceFilters := []types.Filter{tagFilter1, tagFilter2}

	// 查询符合条件的EC2实例
	describeInstancesOutput, err := svc.DescribeInstances(context.TODO(), &ec2.DescribeInstancesInput{
		Filters: instanceFilters,
	})

	if err != nil {
		fmt.Println("无法查询符合条件的EC2实例:", err)
		return
	}

	// 打印符合条件的EC2实例的Tag信息
	fmt.Println("符合条件的EC2实例列表:")
	for _, reservation := range describeInstancesOutput.Reservations {
		for _, instance := range reservation.Instances {

			// 只处理running的实例
			if *&instance.State.Name != "running" {
				continue
			}

			fmt.Printf("Instance ID: %s\n", *instance.InstanceId)
			fmt.Printf("Public IP: %s\n", *instance.PublicIpAddress)

			// 打印Instance的Tag信息
			for _, tag := range instance.Tags {
				fmt.Printf("Tag Name: %s, Tag Value: %s\n", *tag.Key, *tag.Value)
			}

			fmt.Println()
		}
	}
}
