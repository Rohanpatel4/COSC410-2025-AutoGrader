import java.util.*;
import java.io.*;

// Put Main class FIRST so Piston sees it first
public class Main {
    public static void main(String[] args) {
        // Capture console output from student code initialization
        ByteArrayOutputStream consoleBuffer = new ByteArrayOutputStream();
        PrintStream originalOut = System.out;
        PrintStream originalErr = System.err;
        PrintStream captureStream = new PrintStream(consoleBuffer);
        
        System.setOut(captureStream);
        System.setErr(captureStream);
        
        // Initialize student code (static blocks, etc.)
        try {
            Class.forName("Solution");
        } catch (ClassNotFoundException e) {
            // Solution class may not exist, that's OK
        } catch (Exception e) {
            System.err.println("Error loading student code: " + e.getMessage());
        }
        
        // Restore stdout/stderr
        System.setOut(originalOut);
        System.setErr(originalErr);
        
        // Print console output if any
        String consoleOutput = consoleBuffer.toString();
        if (!consoleOutput.isEmpty()) {
            System.out.println("=== Console Output ===");
            System.out.print(consoleOutput);
            System.out.println("=== End Console Output ===");
        }
        
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
