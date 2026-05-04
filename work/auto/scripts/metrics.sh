#!/bin/bash
# Push custom memory and WebSocket metrics to CloudWatch every minute via cron.
# Runs on each ASG instance

TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)

# ---------- memory ----------
read -r total used <<< $(free -m | awk '/^Mem:/ { print $2, $3 }')
if [ "$total" -gt 0 ]; then
    mem_pct=$(awk "BEGIN { printf \"%.2f\", ($used/$total)*100 }")
else
    mem_pct=0
fi

aws cloudwatch put-metric-data \
    --region "$REGION" \
    --namespace "DevOps2/EC2" \
    --metric-data \
        MetricName=MemoryUsedPercent,Value="$mem_pct",Unit=Percent,Dimensions="[{Name=InstanceId,Value=$INSTANCE_ID}]"

# ---------- disk ----------
disk_pct=$(df / | awk 'NR==2 { gsub(/%/,""); print $5 }')

aws cloudwatch put-metric-data \
    --region "$REGION" \
    --namespace "DevOps2/EC2" \
    --metric-data \
        MetricName=DiskUsedPercent,Value="$disk_pct",Unit=Percent,Dimensions="[{Name=InstanceId,Value=$INSTANCE_ID}]"

# ---------- WebSocket connections ----------
ws_count=$(journalctl -u devops2 --since "1 minute ago" --no-pager -q 2>/dev/null \
    | grep -c '"ws"' || true)

aws cloudwatch put-metric-data \
    --region "$REGION" \
    --namespace "DevOps2/EC2" \
    --metric-data \
        MetricName=WebSocketConnections,Value="$ws_count",Unit=Count,Dimensions="[{Name=InstanceId,Value=$INSTANCE_ID}]"
