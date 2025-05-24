.PHONY: all build up down clean

IMAGE_NAME := webgpu-water-simulation
IMAGE_TAG := latest

docker := ./docker-wrapper.sh

all: build up

build:
	@$(docker) build -t $(IMAGE_NAME):$(IMAGE_TAG) .

up:
	@$(docker) run -d -p 8081:80 --name $(IMAGE_NAME) $(IMAGE_NAME):$(IMAGE_TAG)

down:
	@$(docker) stop $(IMAGE_NAME) && $(docker) rm $(IMAGE_NAME)

clean:
	@$(docker) stop $(IMAGE_NAME) || true
	@$(docker) rm $(IMAGE_NAME) || true
	@$(docker) rmi -f $(IMAGE_NAME):$(IMAGE_TAG) || true
