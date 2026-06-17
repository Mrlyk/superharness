# Python Detection Reference

Load this reference when the project has `pyproject.toml`, `setup.py`, `requirements.txt`, or `Pipfile`.

## Manifest Files

| File | What to extract |
|------|----------------|
| `pyproject.toml` | Dependencies, build system, Python version, tool configs (`[tool.ruff]`, `[tool.black]`, `[tool.mypy]`, `[tool.pytest]`) |
| `setup.py` / `setup.cfg` | Legacy package config, dependencies, entry points |
| `requirements.txt` / `requirements-dev.txt` | Direct dependencies (pip) |
| `Pipfile` / `Pipfile.lock` | Dependencies (pipenv) |
| `poetry.lock` | Dependencies (poetry) |
| `uv.lock` | Dependencies (uv) |
| `.python-version` / `runtime.txt` | Python version |
| `tox.ini` / `noxfile.py` | Test/task runner config |
| `Makefile` | Common project commands |
| `manage.py` | Django project indicator |
| `alembic.ini` / `alembic/` | Database migration (SQLAlchemy) |
| `conftest.py` | Pytest configuration and fixtures |
| `.pre-commit-config.yaml` | Pre-commit hooks and quality tools |

## Package Manager Detection

| Indicator | Package manager |
|-----------|----------------|
| `uv.lock` or `[tool.uv]` in pyproject.toml | uv |
| `poetry.lock` or `[tool.poetry]` in pyproject.toml | poetry |
| `Pipfile` | pipenv |
| `environment.yml` / `conda.yaml` | conda |
| `requirements.txt` only | pip |

## Framework Detection Signatures

| Dependency / File | Framework |
|-------------------|-----------|
| `fastapi` | FastAPI (ASGI) |
| `django` + `manage.py` | Django |
| `flask` | Flask (WSGI) |
| `starlette` | Starlette (ASGI) |
| `litestar` | Litestar (ASGI) |
| `click` / `typer` / `fire` | CLI application |
| `celery` | Task queue / worker |
| `langchain` / `llama-index` / `openai` / `anthropic` | AI/LLM application |
| `agentscope` / `autogen` / `crewai` | Multi-agent framework |
| `pandas` / `numpy` / `scikit-learn` | Data science / ML |
| `torch` / `tensorflow` / `transformers` | Deep learning |
| `scrapy` / `beautifulsoup4` | Web scraping |
| `pytest` (as main entry) | Testing library/framework |

## Detection Dimensions

Identify these aspects of the project:

- **Package manager**: pip / uv / poetry / pipenv / conda (detect from lockfile or pyproject.toml config)
- **Framework**: FastAPI / Django / Flask / Starlette / CLI (Click/Typer) / AI agent
- **Python version**: from `[project.requires-python]` or `.python-version`
- **Testing**: pytest / unittest, fixtures pattern, conftest.py structure, async test config
- **Code quality**: Ruff / Black / Flake8 / Pylint / isort / autoflake (check `[tool.*]` sections in pyproject.toml)
- **Type checking**: mypy / pyright / pytype, strictness level
- **API style**: REST / CLI / gRPC / GraphQL (strawberry/ariadne) / MCP
- **Data layer**: SQLAlchemy / Django ORM / Tortoise ORM / Redis / MongoDB (motor/pymongo)
- **Project structure**: flat (package at root) / src layout (`src/pkg/`) / app package (`app/`) / Django apps
- **Async pattern**: asyncio / sync, ASGI (uvicorn/hypercorn) / WSGI (gunicorn)

## Example Output

> - 语言/框架: Python 3.12 + FastAPI
> - 包管理: uv
> - 测试: pytest + pytest-asyncio, fixtures 在 conftest.py
> - 代码质量: Ruff (lint + format) + mypy (strict)
> - API: RESTful, 路由在 app/routers/ 下按资源分文件
> - 数据层: SQLAlchemy 2.0 + Alembic 迁移
> - 项目结构: app/ 包结构
> - 异步: 全异步 (async/await, uvicorn ASGI)
