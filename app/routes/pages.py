"""HTML page routes - full page or HTMX fragment."""

from __future__ import annotations

import json
from pathlib import Path

from litestar import Controller, get
from litestar.response import Template

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "projects.json"


def _load_data() -> dict:
    return json.loads(DATA_FILE.read_text())


class PagesController(Controller):
    path = "/"

    @get("/")
    async def index(self) -> Template:
        data = _load_data()
        return Template(
            template_name="index.html",
            context={
                "projects": data["projects"],
                "experiences": data["experiences"],
                "blog_posts": data["blog_posts"],
            },
        )

    @get("/sections/{name:str}")
    async def section(self, name: str) -> Template:
        data = _load_data()
        return Template(
            template_name="partials/" + name + ".html",
            context={
                "projects": data["projects"],
                "experiences": data["experiences"],
                "blog_posts": data["blog_posts"],
            },
        )
