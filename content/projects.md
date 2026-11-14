---
title: "Projects"
type: "projects"
description: "Side projects by Denis Sazonov — self-hosted tools in Go and Python: a Slack bot that learns which blog posts you want to read, a private photo library that turns memories into narrated films, and a DVR web GUI."
author: "Denis Sazonov"
image: "/images/profile.jpg"
projects:
  - name: "blogger"
    tagline: "Your morning tech reading, picked by an AI that knows your taste"
    description: >
      You follow twenty great blogs and read none of them. Blogger reads every
      one, throws out the noise and drops the few posts you will actually love
      into Slack, right on time for your morning coffee.
    features:
      - icon: "☕"
        title: "Five posts. Not five hundred."
        text: "Each morning you get the best new posts, each with a summary and one line on why it is for you. Can't wait? Type /show."
      - icon: "🎯"
        title: "It gets you. Then it gets you better."
        text: "Tap 👍 or 👎. An LLM rewrites your interest profile, and tomorrow's picks land closer."
      - icon: "🔭"
        title: "Finds blogs you didn't know you needed"
        text: "/discover searches the web for blogs like your favourites. One click on + Add and they are in."
      - icon: "🧹"
        title: "Cleans up after itself"
        text: "A blog that keeps missing gets benched. A good post you skipped gets a second chance a week later."
      - icon: "⏰"
        title: "Never misses a morning"
        text: "Box asleep at digest time? The digest posts the moment it wakes up. A failed run tries again."
      - icon: "🔒"
        title: "Your box, your subscriptions"
        text: "One Go binary in Docker on a Jetson. Runs the official Claude Code CLI, falls back to Codex, then to a local model."
    tags:
      - Go
      - Slack bot
      - LLM agents
      - Self-hosted
    links:
      - text: "GitHub"
        url: "https://github.com/sadensmol/blogger"
  - name: "ivms777"
    tagline: "Your photo library, turned into films you'll want to watch"
    description: >
      Thousands of photos you never look at again. ivms777 understands every
      one of them, then lets you search them, talk to them and relive them as
      narrated films. All on your own machine. Not one photo goes to the cloud.
    features:
      - icon: "🔎"
        title: "Search the way you remember"
        text: "Type \"dogs in snow\" or a name. Your words become date and tag filters, and the right moment comes up."
      - icon: "💬"
        title: "Ask your photos anything"
        text: "Chat answers from your own library and shows the photos behind every answer. Never one it did not find."
      - icon: "📚"
        title: "Albums that build themselves"
        text: "Memories groups your life into named stories like \"Family night in Ontario\". Or browse by date, camera or place."
      - icon: "🎬"
        title: "Every memory becomes a film"
        text: "Press Play: an AI-written story, a spoken narration and a composed score, cut to your photos. Regenerate for a new take."
      - icon: "🎙️"
        title: "Told in a voice you love"
        text: "Record 5–30 seconds of someone you know, and the film speaks in their voice."
      - icon: "⬇️"
        title: "Keep it forever"
        text: "Download the film as MP4 or WebM, straight from the browser. No ffmpeg, no server render."
    image: "/images/projects/ivms777.jpg"
    tags:
      - Python
      - Local AI
      - llama.cpp · Gemma 4
      - SigLIP · MusicGen
    links:
      - text: "GitHub"
        url: "https://github.com/sadensmol/ivms777"
  - name: "ivms666"
    tagline: "The DVR web app your camera vendor never shipped"
    description: >
      Your Hikvision-style DVR/NVR, finally in a browser tab that just works.
      One command, zero installs.
    features:
      - icon: "📺"
        title: "Every camera, one tab"
        text: "Live view, snapshots, motion, recordings, event log and diagnostics. Group devices any way you like."
      - icon: "🛰️"
        title: "Finds cameras you forgot you had"
        text: "A pipelined RTSP scanner sweeps a whole subnet, finds every stream and tests the logins as it goes."
      - icon: "🛡️"
        title: "No lockouts"
        text: "It tries logins one at a time per device, so a scan does not trip your DVR's lockout."
      - icon: "🔐"
        title: "Passwords stay home"
        text: "The local server keeps them. The browser never sees them."
      - icon: "🪶"
        title: "Zero dependencies"
        text: "Pure Python standard library. No pip, no brew, nothing to break."
      - icon: "🔗"
        title: "Paste and go"
        text: "Paste any rtsp:// URL and the camera is set up. Your setup is saved for the next launch."
    image: "/images/projects/ivms666.jpg"
    tags:
      - Python
      - Zero-dependency
      - RTSP / ISAPI
      - Self-hosted
    links:
      - text: "GitHub"
        url: "https://github.com/sadensmol/ivms666"
---

Side projects that solve real problems I had. Every one runs on hardware you
own, keeps your data with you, and stays lean on dependencies.
