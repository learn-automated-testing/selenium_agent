#!/usr/bin/env python3
"""Setup script for Selenium MCP Server package."""

from setuptools import setup, find_packages
from pathlib import Path

# Read README for long description
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text(encoding="utf-8") if readme_file.exists() else ""

setup(
    name="ai-agent-selenium",
    version="1.0.0",
    description="AI-powered Selenium browser automation MCP server with test agents (Planner, Generator, Healer)",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="R. van der Horst",
    author_email="r.vanderhorst@example.com",
    url="https://github.com/learn-automated-testing/selenium-mcp-server",
    license="MIT",

    # Package discovery
    packages=find_packages(exclude=["tests", "tests.*"]),

    # Include non-Python files
    include_package_data=True,
    package_data={
        "": ["agents/*.md"],
    },

    # Python version requirement
    python_requires=">=3.10",

    # Dependencies
    install_requires=[
        "fastmcp>=2.0.0",
        "selenium>=4.0.0",
        "webdriver-manager>=4.0.0",
        "pydantic>=2.0.0",
    ],

    # Optional dependencies
    extras_require={
        "robot": [
            "robotframework>=6.0",
            "robotframework-seleniumlibrary>=6.0",
        ],
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "flake8>=6.0.0",
        ],
    },

    # Entry points for command-line scripts
    entry_points={
        "console_scripts": [
            "selenium-mcp=selenium_mcp.server:main",
        ],
    },

    # Classifiers for PyPI
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
        "Topic :: Software Development :: Testing",
        "Topic :: Software Development :: Quality Assurance",
        "Framework :: Robot Framework",
    ],

    # Keywords for discovery
    keywords=[
        "selenium",
        "mcp",
        "model-context-protocol",
        "browser-automation",
        "testing",
        "test-automation",
        "ai-agents",
        "playwright-alternative",
        "web-testing",
        "test-generator",
        "test-healer",
    ],

    # Project URLs
    project_urls={
        "Documentation": "https://github.com/learn-automated-testing/selenium-mcp-server#readme",
        "Source": "https://github.com/learn-automated-testing/selenium-mcp-server",
        "Bug Reports": "https://github.com/learn-automated-testing/selenium-mcp-server/issues",
    },
)
