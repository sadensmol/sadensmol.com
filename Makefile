.PHONY: up publish-medium

up:
	hugo server -D --navigateToChanged

publish-medium:
	@test -n "$(POST)" || (echo "Usage: make publish-medium POST=content/posts/my-post.md" && exit 1)
	@test -n "$$MEDIUM_TOKEN" || (echo "Error: MEDIUM_TOKEN env var is required" && exit 1)
	bash scripts/publish-medium.sh $(POST)
