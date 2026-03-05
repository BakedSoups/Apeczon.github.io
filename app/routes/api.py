"""API routes - SSE metrics stream + project data."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from pathlib import Path

import msgspec
import psutil
from litestar import Controller, get
from litestar.response import Stream

from app.models import ServerMetrics

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "projects.json"
_encoder = msgspec.json.Encoder()


def _get_metrics() -> ServerMetrics:
    cpu = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory().percent
    load = psutil.getloadavg()
    # Map CPU load to boid count: 30 base + up to 170 more at 100% CPU
    boid_count = int(30 + (cpu / 100) * 170)
    return ServerMetrics(
        cpu_percent=cpu,
        memory_percent=mem,
        load_avg_1m=load[0],
        load_avg_5m=load[1],
        load_avg_15m=load[2],
        boid_count=boid_count,
    )


class MetricsSSEController(Controller):
    path = "/api/metrics"

    @get("/stream")
    async def stream(self) -> Stream:
        async def _generate() -> AsyncGenerator[bytes, None]:
            # prime psutil (first call returns 0.0)
            psutil.cpu_percent(interval=None)
            while True:
                metrics = _get_metrics()
                data = _encoder.encode(metrics).decode()
                yield f"event: metrics\ndata: {data}\n\n".encode()
                await asyncio.sleep(1)

        return Stream(_generate(), media_type="text/event-stream")


class ProjectsController(Controller):
    path = "/api/projects"

    @get("/")
    async def list_projects(self, tag: str | None = None) -> list[dict]:
        data = json.loads(DATA_FILE.read_text())
        projects = data["projects"]
        if tag:
            projects = [
                p for p in projects if tag.lower() in [t.lower() for t in p["tools"]]
            ]
        return projects

    @get("/{slug:str}")
    async def get_project(self, slug: str) -> dict:
        data = json.loads(DATA_FILE.read_text())
        for p in data["projects"]:
            if p["slug"] == slug:
                return p
        return {"error": "not found"}
