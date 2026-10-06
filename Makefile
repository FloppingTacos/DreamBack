CXX := clang++
CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -Wpedantic
.PHONY: test plugin clean
build/core_tests: tests/core_tests.cpp src/core/Feedback.cpp src/core/Feedback.h
	mkdir -p build
	$(CXX) $(CXXFLAGS) -Isrc/core tests/core_tests.cpp src/core/Feedback.cpp -o $@
test: build/core_tests
	./build/core_tests
plugin:
	bash tools/build_mac.sh
clean:
	rm -rf build
