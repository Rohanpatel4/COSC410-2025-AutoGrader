// Suppress warnings for generated test code
#![allow(dead_code)]
#![allow(unused_variables)]

// Student code
$student_code

// Test results structure
struct TestResult {
    id: i32,
    passed: bool,
    points: i32,
}

fn main() {
    let mut test_results: Vec<TestResult> = Vec::new();
    
    // Test execution
    $test_execution_code
    
    // Summary output
    let mut passed = 0;
    let mut failed = 0;
    let mut earned = 0;
    let mut total = 0;
    
    for r in &test_results {
        if r.passed {
            passed += 1;
            earned += r.points;
        } else {
            failed += 1;
        }
        total += r.points;
    }
    
    println!("\n=== Test Results ===");
    println!("Passed: {}", passed);
    println!("Failed: {}", failed);
    println!("Total: {}", test_results.len());
    println!("Earned: {}", earned);
    println!("TotalPoints: {}", total);
}

