.PHONY: up add-post

up:
	hugo server -D --navigateToChanged

add-post:
	@read -p "Post title: " title; \
	slug=$$(echo "$$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$$//'); \
	file="content/posts/$$(date +%Y-%m-%d)-$$slug.md"; \
	hugo new "$$file"; \
	echo "Created: $$file"
