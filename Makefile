.PHONY: production
production: dev_dependencies
	./node_modules/.bin/tsc -b

.PHONY: dev_dependencies
dev_dependencies:
	yarn install --production=false --no-progress  --silent

.PHONY: clean
clean:
	rm ./dist -Rf