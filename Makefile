.PHONY: install dev build start migrate generate test-mock clean api-test

install:
	npm install

dev:
	npm run dev:api

build:
	npm run build

start:
	npm start

migrate:
	npm run db:migrate

generate:
	npm run generate

test-mock:
	npm run test:mock

clean:
	rm -rf dist/ cache/llm/

api-test:
	@echo "=== Health ===" && curl -s http://localhost:3000/api/health
	@echo ""
	@echo "=== Reports ===" && curl -s "http://localhost:3000/api/reports?limit=5"
