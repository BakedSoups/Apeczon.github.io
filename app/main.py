"""Litestar portfolio app - HTMX + native boids."""

from __future__ import annotations

import os
from pathlib import Path

from litestar import Litestar
from litestar.config.compression import CompressionConfig
from litestar.contrib.jinja import JinjaTemplateEngine
from litestar.static_files import StaticFilesConfig
from litestar.template import TemplateConfig

from app.routes.api import MetricsController, ProjectsController
from app.routes.pages import PagesController

BASE = Path(__file__).resolve().parent.parent

app = Litestar(
    route_handlers=[PagesController, MetricsController, ProjectsController],
    template_config=TemplateConfig(
        engine=JinjaTemplateEngine,
        directory=BASE / "templates",
    ),
    static_files_config=[
        StaticFilesConfig(
            directories=[BASE / "static"],
            path="/static",
        ),
    ],
    compression_config=CompressionConfig(backend="gzip"),
    debug=os.getenv("DEBUG", "").lower() in ("1", "true"),
)
