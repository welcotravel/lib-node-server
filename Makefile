.PHONY : dev_dependencies production clean

production: dev_dependencies
	yarn build

dev_dependencies:
	yarn install --production=false --no-progress  --silent

clean:
	rm ./dist -Rf