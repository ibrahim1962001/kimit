import logging
import boto3
from botocore.client import Config
from app.config import settings
from typing import BinaryIO
import io

logger = logging.getLogger("uvicorn.error")

class StorageManager:
    def __init__(self):
        try:
            self.s3 = boto3.client(
                's3',
                endpoint_url=f"http://{settings.MINIO_ENDPOINT}" if not settings.MINIO_SECURE else f"https://{settings.MINIO_ENDPOINT}",
                aws_access_key_id=settings.MINIO_ACCESS_KEY,
                aws_secret_access_key=settings.MINIO_SECRET_KEY,
                config=Config(signature_version='s3v4'),
                region_name='us-east-1'
            )
            self.bucket = settings.MINIO_BUCKET_NAME
            self._ensure_bucket()
        except Exception as e:
            logger.error(f"StorageManager Init Failed: {str(e)}")

    def _ensure_bucket(self):
        try:
            logger.info(f"Checking bucket {self.bucket}")
            self.s3.head_bucket(Bucket=self.bucket)
        except Exception as e:
            logger.warning(f"Creating bucket {self.bucket} due to: {str(e)}")
            self.s3.create_bucket(Bucket=self.bucket)

    def upload_file(self, file_content: bytes, file_name: str, content_type: str = "application/octet-stream") -> str:
        """Uploads a file to MinIO and returns the object name."""
        try:
            logger.info(f"Uploading {file_name} to MinIO...")
            self.s3.put_object(
                Bucket=self.bucket,
                Key=file_name,
                Body=file_content,
                ContentType=content_type
            )
            logger.info(f"Upload successful: {file_name}")
            return file_name
        except Exception as e:
            logger.error(f"MinIO Upload Failed for {file_name}: {str(e)}")
            raise e

    async def upload_bytes(
        self, file_content: bytes, file_name: str, content_type: str = "application/octet-stream"
    ) -> str:
        """Async-compatible alias used by charge_router."""
        return self.upload_file(file_content, file_name, content_type)

    def download_file(self, file_name: str) -> bytes:
        """Downloads a file from MinIO."""
        response = self.s3.get_object(Bucket=self.bucket, Key=file_name)
        return response['Body'].read()

    def get_presigned_url(self, file_name: str, expires_in: int = 3600) -> str:
        """Generates a presigned URL for a file."""
        return self.s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': file_name},
            ExpiresIn=expires_in
        )

storage_manager = StorageManager()
