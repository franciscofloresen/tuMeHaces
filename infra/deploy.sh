#!/bin/bash
set -e

STACK_NAME="tu-me-haces-stack"
REGION="us-east-1"

# Deploy CloudFormation
echo "Deploying infrastructure..."
aws cloudformation deploy \
  --template-file infra/template.yaml \
  --stack-name $STACK_NAME \
  --region $REGION \
  --no-fail-on-empty-changeset

# Get outputs
BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)
DIST_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text)

# Build and sync
echo "Building app..."
npm run build

echo "Uploading to S3..."
aws s3 sync dist/ s3://$BUCKET --delete

echo "Invalidating cache..."
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*" > /dev/null

echo "Done! Site available at: $URL"
