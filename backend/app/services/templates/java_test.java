import java.util.*;

// Put Main class FIRST so Piston sees it first
public class Main {
    public static void main(String[] args) {
        List<Map<String, Object>> testResults = new ArrayList<>();
        
        // Test execution
        $test_execution_code
        
        // Summary output
        int passed = 0;
        int failed = 0;
        int earned = 0;
        int total = 0;
        for (Map<String, Object> r : testResults) {
            if ((Boolean) r.get("passed")) {
                passed++;
                earned += (Integer) r.get("points");
            } else {
                failed++;
            }
            total += (Integer) r.get("points");
        }
        
        System.out.println("\n=== Test Results ===");
        System.out.println("Passed: " + passed);
        System.out.println("Failed: " + failed);
        System.out.println("Total: " + testResults.size());
        System.out.println("Earned: " + earned);
        System.out.println("TotalPoints: " + total);
    }
}

// Student code (package-private class, appears after Main)
$student_code

