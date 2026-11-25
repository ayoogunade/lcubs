CXX      ?= clang++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra

all: bin/baseline bin/fasterAlgo

bin/%: src/%.cpp src/common.hpp | bin
	$(CXX) $(CXXFLAGS) -o $@ $<

bin:
	mkdir -p bin

test: all
	python3 tests/test_against_brute.py

clean:
	rm -rf bin

.PHONY: all test clean
