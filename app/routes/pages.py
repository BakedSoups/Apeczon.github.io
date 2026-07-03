"""HTML page routes - full page or HTMX fragment."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from litestar import Controller, get
from litestar.response import Template

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "projects.json"
FILTER_TAGS = [
    {
        "label": "Explainable Search Engines",
        "slug": "explainable-search",
        "description": "Projects that help users search or recommend things while showing why the result makes sense.",
    },
    {
        "label": "Games + Sims",
        "slug": "games-sims",
        "description": "Interactive projects where systems, simulations, procedural rules, or game loops do the talking.",
    },
    {
        "label": "Long term Builds",
        "slug": "long-term-builds",
        "description": "Projects I kept building past the initial idea instead of leaving as one off demos.",
    },
]


@lru_cache(maxsize=1)
def _load_data() -> dict:
    data = json.loads(DATA_FILE.read_text())

    def _text(parts: list[str]) -> str:
        return " ".join(parts).lower()

    def _project_buckets(text: str) -> list[str]:
        buckets = []

        if re.search(r"\b(recommend\w*|search\w*|rag|retrieval|similar|explainable|why|crawler|filters?)\b", text):
            buckets.append("explainable-search")
        if any(
            term in text
            for term in (
                "godot",
                "game jam",
                "gdc",
                "itch.io",
                "simulator",
                "3d",
                "shaders",
                "ebitengine",
                "browser game",
                "spacetimedb",
                "webassembly",
            )
        ):
            buckets.append("games-sims")
        if "long term" in text:
            buckets.append("long-term-builds")

        return buckets

    def _search_text(parts: list[str], buckets: list[str]) -> str:
        text = " ".join(parts).lower()
        return " ".join([text, *buckets])

    def _blog_year(post: dict) -> int:
        if post.get("blog_year"):
            return int(post["blog_year"])
        match = re.search(r"\b(20\d{2})\b", " ".join([post.get("sort_date", ""), post.get("date", "")]))
        return int(match.group(1)) if match else 0

    for project in data["projects"]:
        searchable = [
            project["title"],
            project["description"],
            project["long_description"],
            *project["tools"],
        ]
        text = _text(searchable)
        project["filter_buckets"] = _project_buckets(text)
        project["search_text"] = _search_text(searchable, project["filter_buckets"])

    blog_posts = sorted(
        data["blog_posts"],
        key=lambda post: post.get("sort_date", post.get("date", "")),
        reverse=True,
    )
    data["blog_posts"] = blog_posts
    data["blog_year_pages"] = [
        {
            "year": year,
            "posts": [
                post
                for post in blog_posts
                if _blog_year(post) == year
            ],
        }
        for year in range(2026, 2021, -1)
    ]

    data["filter_tags"] = FILTER_TAGS
    return data


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
                "blog_year_pages": data["blog_year_pages"],
                "filter_tags": data["filter_tags"],
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
                "blog_year_pages": data["blog_year_pages"],
                "filter_tags": data["filter_tags"],
            },
        )
