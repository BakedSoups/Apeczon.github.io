"""Pydantic-style models via msgspec for zero-overhead validation."""

from __future__ import annotations

import msgspec


class Project(msgspec.Struct):
    slug: str
    title: str
    description: str
    long_description: str
    image: str
    badge: str | None = None
    tools: list[str] = []
    links: list[Link] = []


class Link(msgspec.Struct):
    label: str
    url: str
    icon: str  # Font Awesome class


class Experience(msgspec.Struct):
    company: str
    logo: str
    role: str
    duration: str
    location: str
    details: list[str]
    tech: list[str]


class BlogPost(msgspec.Struct):
    slug: str
    title: str
    date: str
    label: str
    label_color: str  # CSS variable name
    content_html: str
    tags: list[str]


class ServerMetrics(msgspec.Struct):
    cpu_percent: float
    memory_percent: float
    load_avg_1m: float
    load_avg_5m: float
    load_avg_15m: float
    boid_count: int  # derived from load


class ContactForm(msgspec.Struct):
    name: str
    email: str
    message: str
