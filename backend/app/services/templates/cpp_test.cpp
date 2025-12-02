#include <iostream>
#include <sstream>
#include <vector>
#include <string>
#include <cassert>
#include <cstdlib>
#include <stdexcept>

// Custom assertion macro that throws instead of aborting
#define test_assert(condition) \
    do { \
        if (!(condition)) { \
            throw std::runtime_error("Assertion failed: " #condition); \
        } \
    } while(0)

// Student code
$student_code

struct TestResult {
    int id;
    bool passed;
    int points;
    std::string error_msg;
    std::string output;
    std::string stderr_output;
};

int main() {
    // Capture any output from student code initialization
    std::stringstream console_buffer;
    std::streambuf* old_cout = std::cout.rdbuf(console_buffer.rdbuf());
    std::streambuf* old_cerr = std::cerr.rdbuf(console_buffer.rdbuf());
    
    // Restore stdout/stderr for test output
    std::cout.rdbuf(old_cout);
    std::cerr.rdbuf(old_cerr);
    
    // Print console output if any
    std::string console_output = console_buffer.str();
    if (!console_output.empty()) {
        std::cout << "=== Console Output ===" << std::endl;
        std::cout << console_output;
        std::cout << "=== End Console Output ===" << std::endl;
    }
    
    std::vector<TestResult> testResults;
    
    // Test execution
    $test_execution_code
    
    // Summary output
    int passed = 0;
    int failed = 0;
    int earned = 0;
    int total = 0;
    for (const auto& r : testResults) {
        if (r.passed) {
            passed++;
            earned += r.points;
        } else {
            failed++;
        }
        total += r.points;
    }
    
    std::cout << "\n=== Test Results ===" << std::endl;
    std::cout << "Passed: " << passed << std::endl;
    std::cout << "Failed: " << failed << std::endl;
    std::cout << "Total: " << testResults.size() << std::endl;
    std::cout << "Earned: " << earned << std::endl;
    std::cout << "TotalPoints: " << total << std::endl;
    
    return 0;
}
