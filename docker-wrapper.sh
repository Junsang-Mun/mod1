#!/bin/bash
if command -v podman &> /dev/null; then
    podman "$@"
else
    docker "$@"
fi
