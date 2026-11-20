from typing import List, Dict
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DB_HOST_PRIMARY: str = "20.169.214.104"
    DB_HOSTS_CLUSTER: str = "20.169.214.104,172.191.145.235,172.174.36.131"
    DB_PORT: int = 3306
    DB_USER: str = "pos_app"
    DB_PASSWORD: str = "ChangeMeSecure123!"
    DB_NAME: str = "pos"
    DB_POOL_MIN_SIZE: int = 2
    DB_POOL_MAX_SIZE: int = 10

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://20.169.214.104:5173,http://20.169.214.104"

    MONGO_URI: str = "mongodb://20.169.214.104:27017"
    MONGO_DB: str = "pos_analytics"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def cluster_nodes(self) -> List[Dict[str, any]]:
        hosts = [h.strip() for h in self.DB_HOSTS_CLUSTER.split(",") if h.strip()]
        return [{"id": i + 1, "name": f"Node {i + 1}", "host": host} for i, host in enumerate(hosts)]


settings = Settings()
