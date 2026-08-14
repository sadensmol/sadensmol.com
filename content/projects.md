---
title: "Projects"
type: "projects"
description: "Side projects by Denis Sazonov — local-first tools built with zero (or near-zero) dependencies. Go, Python, and a preference for software that runs entirely on your own machine."
author: "Denis Sazonov"
image: "/images/profile.jpg"
projects:
  - name: "ivms666"
    tagline: "Local GUI for Hikvision-style DVR/NVRs"
    description: >
      A tiny, zero-dependency (Python stdlib only — no pip/brew) local web GUI
      for Hikvision-style DVR/NVRs. Runs a small local server and opens your
      browser: snapshots, live view, motion, recordings, event log, diagnose,
      plus a pipelined RTSP scanner that finds and credential-verifies streams
      across a subnet. Credentials stay on the server — the browser never sees
      them.
    image: "/images/projects/ivms666.jpg"
    tags:
      - Python
      - Zero-dependency
      - RTSP / ISAPI
      - Self-hosted
    links:
      - text: "GitHub"
        url: "https://github.com/sadensmol/ivms666"
  - name: "ivms777"
    tagline: "Private, local photo library organizer"
    description: >
      A local photo library organizer that classifies, searches, and groups a
      photo folder using local models — nothing is sent to a third-party API.
      Every photo is embedded with SigLIP and tagged across ten dimensions;
      search blends SigLIP semantic similarity with FTS5 keyword match via
      reciprocal-rank fusion, so "dogs in snow" finds the look while a proper
      noun finds the word.
    image: "/images/projects/ivms777.jpg"
    tags:
      - Python
      - Local models
      - SigLIP · Ollama
      - Semantic search
    links:
      - text: "GitHub"
        url: "https://github.com/sadensmol/ivms777"
---

A few local-first side projects. Everything here runs on your own machine — no
cloud, minimal (or zero) dependencies.
