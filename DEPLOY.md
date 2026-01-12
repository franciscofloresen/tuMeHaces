# Guía de Despliegue - tu-me-haces

## URL de Producción
https://d3vw2imtigjp78.cloudfront.net

## Arquitectura
```
Usuario → CloudFront (CDN + HTTPS) → S3 (archivos estáticos)
```

## Requisitos
- Node.js
- AWS CLI configurado (`aws configure`)

## Desplegar cambios
```bash
./infra/deploy.sh
```

## Comandos útiles

### Ver estado del stack
```bash
aws cloudformation describe-stacks --stack-name tu-me-haces-stack --region us-east-1
```

### Solo subir archivos (sin recrear infra)
```bash
npm run build
aws s3 sync dist/ s3://tu-me-haces-107759015501 --delete
aws cloudfront create-invalidation --distribution-id E2EXAMPLE --paths "/*"
```

### Eliminar toda la infraestructura
```bash
aws s3 rm s3://tu-me-haces-107759015501 --recursive
aws cloudformation delete-stack --stack-name tu-me-haces-stack --region us-east-1
```

## Archivos de infraestructura
- `infra/template.yaml` - CloudFormation (S3 + CloudFront)
- `infra/deploy.sh` - Script de deploy automatizado

## Costos
Free Tier elegible:
- S3: 5GB almacenamiento, 20K requests/mes
- CloudFront: 1TB transferencia/mes
