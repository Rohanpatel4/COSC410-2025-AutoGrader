// Suppress warnings for generated test code
#![allow(dead_code)]
#![allow(unused_variables)]
#![allow(unused_imports)]
#![allow(unused_macros)]

use std::io::{self, Write};
use std::panic;

// Default stub module - provides fallback implementations
// Student code can override these by defining functions with the same name
mod _stubs {
$stub_functions
}

// Re-export stubs (will be shadowed by student definitions)
#[allow(unused_imports)]
use _stubs::*;

// Student code (can override stub functions)
$student_code

// Test results structure
struct TestResult {
    id: i32,
    passed: bool,
    points: i32,
    error_msg: Option<String>,
    output: Option<String>,
}

fn main() {
    // Note: Rust doesn't easily support stdout capture at runtime like other languages
    // Console output from student code will appear in the normal output
    // We print a marker so the parser knows where console output might be
    
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
            // Print error info for failed tests
            if let Some(ref err) = r.error_msg {
                println!("ERROR_{}: {}", r.id, err);
            }
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
