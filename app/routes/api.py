"""API routes - metrics polling + project data."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import psutil
from litestar import Controller, get

from app.models import ServerMetrics

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "projects.json"


def _get_metrics() -> ServerMetrics:
    cpu = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory().percent
    load = psutil.getloadavg()
    boid_count = int(30 + (cpu / 100) * 170)
    return ServerMetrics(
        cpu_percent=cpu,
        memory_percent=mem,
        load_avg_1m=load[0],
        load_avg_5m=load[1],
        load_avg_15m=load[2],
        boid_count=boid_count,
    )


class MetricsController(Controller):
    path = "/api/metrics"

    @get("/")
    async def get_metrics(self) -> ServerMetrics:
        psutil.cpu_percent(interval=None)
        return _get_metrics()


class ProjectsController(Controller):
    path = "/api/projects"

    @get("/")
    async def list_projects(self, tag: str | None = None) -> list[dict]:
        data = _load_project_data()
        projects = data["projects"]
        if tag:
            projects = [
                p for p in projects if tag.lower() in [t.lower() for t in p["tools"]]
            ]
        return projects

    @get("/{slug:str}")
    async def get_project(self, slug: str) -> dict:
        data = _load_project_data()
        for p in data["projects"]:
            if p["slug"] == slug:
                return p
        return {"error": "not found"}


@lru_cache(maxsize=1)
def _load_project_data() -> dict:
    return json.loads(DATA_FILE.read_text())
