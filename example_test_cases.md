# Example Test Cases for AutoGrader

This file contains ready-to-use test cases for Python, Java, and C++ assignments. Copy and paste these into your assignment's test case interface.

---

## Assignment: Simple Calculator

**Expected Student Code:**
- Python: Functions `add(x, y)`, `subtract(x, y)`, `multiply(x, y)`, `divide(x, y)`
- Java: Class `Solution` with methods `add(int x, int y)`, `subtract(int x, int y)`, `multiply(int x, int y)`, `divide(double x, double y)`
- C++: Functions `int add(int x, int y)`, `int subtract(int x, int y)`, `int multiply(int x, int y)`, `double divide(double x, double y)`

---

## Python Test Cases

### Test Case 1: Basic Addition (Visible, 10 points)
```python
assert add(5, 3) == 8
assert add(10, 20) == 30
assert add(0, 0) == 0
```

### Test Case 2: Addition with Negatives (Visible, 10 points)
```python
assert add(-5, -3) == -8
assert add(-10, 5) == -5
assert add(5, -3) == 2
```

### Test Case 3: Basic Subtraction (Visible, 10 points)
```python
assert subtract(10, 3) == 7
assert subtract(20, 5) == 15
assert subtract(5, 5) == 0
```

### Test Case 4: Subtraction with Negatives (Visible, 10 points)
```python
assert subtract(-5, -3) == -2
assert subtract(5, -3) == 8
assert subtract(-5, 3) == -8
```

### Test Case 5: Basic Multiplication (Visible, 10 points)
```python
assert multiply(5, 3) == 15
assert multiply(10, 2) == 20
assert multiply(0, 100) == 0
```

### Test Case 6: Multiplication with Negatives (Visible, 10 points)
```python
assert multiply(-5, 3) == -15
assert multiply(-5, -3) == 15
assert multiply(5, -3) == -15
```

### Test Case 7: Basic Division (Visible, 10 points)
```python
assert divide(10, 2) == 5.0
assert divide(15, 3) == 5.0
assert divide(9, 2) == 4.5
```

### Test Case 8: Division with Negatives (Visible, 10 points)
```python
assert divide(-10, 2) == -5.0
assert divide(10, -2) == -5.0
assert divide(-10, -2) == 5.0
```

### Test Case 9: Division by Zero (Hidden, 15 points)
```python
try:
    divide(10, 0)
    assert False, "Should have raised ZeroDivisionError"
except ZeroDivisionError:
    assert True
```

### Test Case 10: Large Numbers (Hidden, 10 points)
```python
assert add(1000000, 2000000) == 3000000
assert multiply(1000, 1000) == 1000000
assert subtract(5000000, 2000000) == 3000000
```

---

## Java Test Cases

### Test Case 1: Basic Addition (Visible, 10 points)
```java
Solution s = new Solution();
assert s.add(5, 3) == 8;
assert s.add(10, 20) == 30;
assert s.add(0, 0) == 0;
```

### Test Case 2: Addition with Negatives (Visible, 10 points)
```java
Solution s = new Solution();
assert s.add(-5, -3) == -8;
assert s.add(-10, 5) == -5;
assert s.add(5, -3) == 2;
```

### Test Case 3: Basic Subtraction (Visible, 10 points)
```java
Solution s = new Solution();
assert s.subtract(10, 3) == 7;
assert s.subtract(20, 5) == 15;
assert s.subtract(5, 5) == 0;
```

### Test Case 4: Subtraction with Negatives (Visible, 10 points)
```java
Solution s = new Solution();
assert s.subtract(-5, -3) == -2;
assert s.subtract(5, -3) == 8;
assert s.subtract(-5, 3) == -8;
```

### Test Case 5: Basic Multiplication (Visible, 10 points)
```java
Solution s = new Solution();
assert s.multiply(5, 3) == 15;
assert s.multiply(10, 2) == 20;
assert s.multiply(0, 100) == 0;
```

### Test Case 6: Multiplication with Negatives (Visible, 10 points)
```java
Solution s = new Solution();
assert s.multiply(-5, 3) == -15;
assert s.multiply(-5, -3) == 15;
assert s.multiply(5, -3) == -15;
```

### Test Case 7: Basic Division (Visible, 10 points)
```java
Solution s = new Solution();
assert Math.abs(s.divide(10.0, 2.0) - 5.0) < 0.0001;
assert Math.abs(s.divide(15.0, 3.0) - 5.0) < 0.0001;
assert Math.abs(s.divide(9.0, 2.0) - 4.5) < 0.0001;
```

### Test Case 8: Division with Negatives (Visible, 10 points)
```java
Solution s = new Solution();
assert Math.abs(s.divide(-10.0, 2.0) - (-5.0)) < 0.0001;
assert Math.abs(s.divide(10.0, -2.0) - (-5.0)) < 0.0001;
assert Math.abs(s.divide(-10.0, -2.0) - 5.0) < 0.0001;
```

### Test Case 9: Division by Zero (Hidden, 15 points)
```java
Solution s = new Solution();
try {
    s.divide(10.0, 0.0);
    assert false : "Should have thrown ArithmeticException";
} catch (ArithmeticException e) {
    assert true;
}
```

### Test Case 10: Large Numbers (Hidden, 10 points)
```java
Solution s = new Solution();
assert s.add(1000000, 2000000) == 3000000;
assert s.multiply(1000, 1000) == 1000000;
assert s.subtract(5000000, 2000000) == 3000000;
```

---

## C++ Test Cases

### Test Case 1: Basic Addition (Visible, 10 points)
```cpp
assert(add(5, 3) == 8);
assert(add(10, 20) == 30);
assert(add(0, 0) == 0);
```

### Test Case 2: Addition with Negatives (Visible, 10 points)
```cpp
assert(add(-5, -3) == -8);
assert(add(-10, 5) == -5);
assert(add(5, -3) == 2);
```

### Test Case 3: Basic Subtraction (Visible, 10 points)
```cpp
assert(subtract(10, 3) == 7);
assert(subtract(20, 5) == 15);
assert(subtract(5, 5) == 0);
```

### Test Case 4: Subtraction with Negatives (Visible, 10 points)
```cpp
assert(subtract(-5, -3) == -2);
assert(subtract(5, -3) == 8);
assert(subtract(-5, 3) == -8);
```

### Test Case 5: Basic Multiplication (Visible, 10 points)
```cpp
assert(multiply(5, 3) == 15);
assert(multiply(10, 2) == 20);
assert(multiply(0, 100) == 0);
```

### Test Case 6: Multiplication with Negatives (Visible, 10 points)
```cpp
assert(multiply(-5, 3) == -15);
assert(multiply(-5, -3) == 15);
assert(multiply(5, -3) == -15);
```

### Test Case 7: Basic Division (Visible, 10 points)
```cpp
#include <cmath>
assert(std::abs(divide(10.0, 2.0) - 5.0) < 0.0001);
assert(std::abs(divide(15.0, 3.0) - 5.0) < 0.0001);
assert(std::abs(divide(9.0, 2.0) - 4.5) < 0.0001);
```

### Test Case 8: Division with Negatives (Visible, 10 points)
```cpp
#include <cmath>
assert(std::abs(divide(-10.0, 2.0) - (-5.0)) < 0.0001);
assert(std::abs(divide(10.0, -2.0) - (-5.0)) < 0.0001);
assert(std::abs(divide(-10.0, -2.0) - 5.0) < 0.0001);
```

### Test Case 9: Division by Zero (Hidden, 15 points)
```cpp
#include <stdexcept>
try {
    divide(10.0, 0.0);
    assert(false && "Should have thrown exception");
} catch (const std::exception& e) {
    assert(true);
}
```

### Test Case 10: Large Numbers (Hidden, 10 points)
```cpp
assert(add(1000000, 2000000) == 3000000);
assert(multiply(1000, 1000) == 1000000);
assert(subtract(5000000, 2000000) == 3000000);
```

---

## Assignment: String Manipulation

**Expected Student Code:**
- Python: Functions `reverse_string(s)`, `uppercase(s)`, `count_vowels(s)`
- Java: Class `Solution` with methods `reverseString(String s)`, `uppercase(String s)`, `countVowels(String s)`
- C++: Functions `std::string reverseString(std::string s)`, `std::string uppercase(std::string s)`, `int countVowels(std::string s)`

---

## Python Test Cases (String Manipulation)

### Test Case 1: Reverse String - Basic (Visible, 10 points)
```python
assert reverse_string("hello") == "olleh"
assert reverse_string("world") == "dlrow"
assert reverse_string("abc") == "cba"
```

### Test Case 2: Reverse String - Edge Cases (Visible, 10 points)
```python
assert reverse_string("") == ""
assert reverse_string("a") == "a"
assert reverse_string("ab") == "ba"
```

### Test Case 3: Uppercase - Basic (Visible, 10 points)
```python
assert uppercase("hello") == "HELLO"
assert uppercase("world") == "WORLD"
assert uppercase("test") == "TEST"
```

### Test Case 4: Uppercase - Edge Cases (Visible, 10 points)
```python
assert uppercase("") == ""
assert uppercase("HELLO") == "HELLO"
assert uppercase("123") == "123"
```

### Test Case 5: Count Vowels - Basic (Visible, 10 points)
```python
assert count_vowels("hello") == 2
assert count_vowels("world") == 1
assert count_vowels("aeiou") == 5
```

### Test Case 6: Count Vowels - Edge Cases (Visible, 10 points)
```python
assert count_vowels("") == 0
assert count_vowels("bcdfg") == 0
assert count_vowels("HELLO") == 2
```

### Test Case 7: Complex Strings (Hidden, 15 points)
```python
assert reverse_string("Hello World!") == "!dlroW olleH"
assert uppercase("hello world") == "HELLO WORLD"
assert count_vowels("Programming") == 3
```

---

## Java Test Cases (String Manipulation)

### Test Case 1: Reverse String - Basic (Visible, 10 points)
```java
Solution s = new Solution();
assert s.reverseString("hello").equals("olleh");
assert s.reverseString("world").equals("dlrow");
assert s.reverseString("abc").equals("cba");
```

### Test Case 2: Reverse String - Edge Cases (Visible, 10 points)
```java
Solution s = new Solution();
assert s.reverseString("").equals("");
assert s.reverseString("a").equals("a");
assert s.reverseString("ab").equals("ba");
```

### Test Case 3: Uppercase - Basic (Visible, 10 points)
```java
Solution s = new Solution();
assert s.uppercase("hello").equals("HELLO");
assert s.uppercase("world").equals("WORLD");
assert s.uppercase("test").equals("TEST");
```

### Test Case 4: Uppercase - Edge Cases (Visible, 10 points)
```java
Solution s = new Solution();
assert s.uppercase("").equals("");
assert s.uppercase("HELLO").equals("HELLO");
assert s.uppercase("123").equals("123");
```

### Test Case 5: Count Vowels - Basic (Visible, 10 points)
```java
Solution s = new Solution();
assert s.countVowels("hello") == 2;
assert s.countVowels("world") == 1;
assert s.countVowels("aeiou") == 5;
```

### Test Case 6: Count Vowels - Edge Cases (Visible, 10 points)
```java
Solution s = new Solution();
assert s.countVowels("") == 0;
assert s.countVowels("bcdfg") == 0;
assert s.countVowels("HELLO") == 2;
```

### Test Case 7: Complex Strings (Hidden, 15 points)
```java
Solution s = new Solution();
assert s.reverseString("Hello World!").equals("!dlroW olleH");
assert s.uppercase("hello world").equals("HELLO WORLD");
assert s.countVowels("Programming") == 3;
```

---

## C++ Test Cases (String Manipulation)

### Test Case 1: Reverse String - Basic (Visible, 10 points)
```cpp
#include <string>
assert(reverseString("hello") == "olleh");
assert(reverseString("world") == "dlrow");
assert(reverseString("abc") == "cba");
```

### Test Case 2: Reverse String - Edge Cases (Visible, 10 points)
```cpp
#include <string>
assert(reverseString("") == "");
assert(reverseString("a") == "a");
assert(reverseString("ab") == "ba");
```

### Test Case 3: Uppercase - Basic (Visible, 10 points)
```cpp
#include <string>
assert(uppercase("hello") == "HELLO");
assert(uppercase("world") == "WORLD");
assert(uppercase("test") == "TEST");
```

### Test Case 4: Uppercase - Edge Cases (Visible, 10 points)
```cpp
#include <string>
assert(uppercase("") == "");
assert(uppercase("HELLO") == "HELLO");
assert(uppercase("123") == "123");
```

### Test Case 5: Count Vowels - Basic (Visible, 10 points)
```cpp
#include <string>
assert(countVowels("hello") == 2);
assert(countVowels("world") == 1);
assert(countVowels("aeiou") == 5);
```

### Test Case 6: Count Vowels - Edge Cases (Visible, 10 points)
```cpp
#include <string>
assert(countVowels("") == 0);
assert(countVowels("bcdfg") == 0);
assert(countVowels("HELLO") == 2);
```

### Test Case 7: Complex Strings (Hidden, 15 points)
```cpp
#include <string>
assert(reverseString("Hello World!") == "!dlroW olleH");
assert(uppercase("hello world") == "HELLO WORLD");
assert(countVowels("Programming") == 3);
```

---

## Assignment: Array/List Operations

**Expected Student Code:**
- Python: Functions `find_max(lst)`, `find_min(lst)`, `sum_list(lst)`
- Java: Class `Solution` with methods `findMax(int[] arr)`, `findMin(int[] arr)`, `sumList(int[] arr)`
- C++: Functions `int findMax(std::vector<int> arr)`, `int findMin(std::vector<int> arr)`, `int sumList(std::vector<int> arr)`

---

## Python Test Cases (Array Operations)

### Test Case 1: Find Max - Basic (Visible, 10 points)
```python
assert find_max([1, 5, 3, 9, 2]) == 9
assert find_max([10, 20, 30]) == 30
assert find_max([-5, -1, -10]) == -1
```

### Test Case 2: Find Max - Edge Cases (Visible, 10 points)
```python
assert find_max([5]) == 5
assert find_max([1, 1, 1, 1]) == 1
assert find_max([0, 0, 0]) == 0
```

### Test Case 3: Find Min - Basic (Visible, 10 points)
```python
assert find_min([1, 5, 3, 9, 2]) == 1
assert find_min([10, 20, 30]) == 10
assert find_min([-5, -1, -10]) == -10
```

### Test Case 4: Find Min - Edge Cases (Visible, 10 points)
```python
assert find_min([5]) == 5
assert find_min([1, 1, 1, 1]) == 1
assert find_min([0, 0, 0]) == 0
```

### Test Case 5: Sum List - Basic (Visible, 10 points)
```python
assert sum_list([1, 2, 3, 4, 5]) == 15
assert sum_list([10, 20, 30]) == 60
assert sum_list([-5, -3, -2]) == -10
```

### Test Case 6: Sum List - Edge Cases (Visible, 10 points)
```python
assert sum_list([]) == 0
assert sum_list([5]) == 5
assert sum_list([0, 0, 0]) == 0
```

### Test Case 7: Large Arrays (Hidden, 15 points)
```python
large_list = list(range(1, 1001))
assert find_max(large_list) == 1000
assert find_min(large_list) == 1
assert sum_list(large_list) == 500500
```

---

## Java Test Cases (Array Operations)

### Test Case 1: Find Max - Basic (Visible, 10 points)
```java
Solution s = new Solution();
assert s.findMax(new int[]{1, 5, 3, 9, 2}) == 9;
assert s.findMax(new int[]{10, 20, 30}) == 30;
assert s.findMax(new int[]{-5, -1, -10}) == -1;
```

### Test Case 2: Find Max - Edge Cases (Visible, 10 points)
```java
Solution s = new Solution();
assert s.findMax(new int[]{5}) == 5;
assert s.findMax(new int[]{1, 1, 1, 1}) == 1;
assert s.findMax(new int[]{0, 0, 0}) == 0;
```

### Test Case 3: Find Min - Basic (Visible, 10 points)
```java
Solution s = new Solution();
assert s.findMin(new int[]{1, 5, 3, 9, 2}) == 1;
assert s.findMin(new int[]{10, 20, 30}) == 10;
assert s.findMin(new int[]{-5, -1, -10}) == -10;
```

### Test Case 4: Find Min - Edge Cases (Visible, 10 points)
```java
Solution s = new Solution();
assert s.findMin(new int[]{5}) == 5;
assert s.findMin(new int[]{1, 1, 1, 1}) == 1;
assert s.findMin(new int[]{0, 0, 0}) == 0;
```

### Test Case 5: Sum List - Basic (Visible, 10 points)
```java
Solution s = new Solution();
assert s.sumList(new int[]{1, 2, 3, 4, 5}) == 15;
assert s.sumList(new int[]{10, 20, 30}) == 60;
assert s.sumList(new int[]{-5, -3, -2}) == -10;
```

### Test Case 6: Sum List - Edge Cases (Visible, 10 points)
```java
Solution s = new Solution();
assert s.sumList(new int[]{}) == 0;
assert s.sumList(new int[]{5}) == 5;
assert s.sumList(new int[]{0, 0, 0}) == 0;
```

### Test Case 7: Large Arrays (Hidden, 15 points)
```java
Solution s = new Solution();
int[] large = new int[1000];
for (int i = 0; i < 1000; i++) {
    large[i] = i + 1;
}
assert s.findMax(large) == 1000;
assert s.findMin(large) == 1;
assert s.sumList(large) == 500500;
```

---

## C++ Test Cases (Array Operations)

### Test Case 1: Find Max - Basic (Visible, 10 points)
```cpp
#include <vector>
std::vector<int> v1 = {1, 5, 3, 9, 2};
std::vector<int> v2 = {10, 20, 30};
std::vector<int> v3 = {-5, -1, -10};
assert(findMax(v1) == 9);
assert(findMax(v2) == 30);
assert(findMax(v3) == -1);
```

### Test Case 2: Find Max - Edge Cases (Visible, 10 points)
```cpp
#include <vector>
std::vector<int> v1 = {5};
std::vector<int> v2 = {1, 1, 1, 1};
std::vector<int> v3 = {0, 0, 0};
assert(findMax(v1) == 5);
assert(findMax(v2) == 1);
assert(findMax(v3) == 0);
```

### Test Case 3: Find Min - Basic (Visible, 10 points)
```cpp
#include <vector>
std::vector<int> v1 = {1, 5, 3, 9, 2};
std::vector<int> v2 = {10, 20, 30};
std::vector<int> v3 = {-5, -1, -10};
assert(findMin(v1) == 1);
assert(findMin(v2) == 10);
assert(findMin(v3) == -10);
```

### Test Case 4: Find Min - Edge Cases (Visible, 10 points)
```cpp
#include <vector>
std::vector<int> v1 = {5};
std::vector<int> v2 = {1, 1, 1, 1};
std::vector<int> v3 = {0, 0, 0};
assert(findMin(v1) == 5);
assert(findMin(v2) == 1);
assert(findMin(v3) == 0);
```

### Test Case 5: Sum List - Basic (Visible, 10 points)
```cpp
#include <vector>
std::vector<int> v1 = {1, 2, 3, 4, 5};
std::vector<int> v2 = {10, 20, 30};
std::vector<int> v3 = {-5, -3, -2};
assert(sumList(v1) == 15);
assert(sumList(v2) == 60);
assert(sumList(v3) == -10);
```

### Test Case 6: Sum List - Edge Cases (Visible, 10 points)
```cpp
#include <vector>
std::vector<int> v1 = {};
std::vector<int> v2 = {5};
std::vector<int> v3 = {0, 0, 0};
assert(sumList(v1) == 0);
assert(sumList(v2) == 5);
assert(sumList(v3) == 0);
```

### Test Case 7: Large Arrays (Hidden, 15 points)
```cpp
#include <vector>
std::vector<int> large(1000);
for (int i = 0; i < 1000; i++) {
    large[i] = i + 1;
}
assert(findMax(large) == 1000);
assert(findMin(large) == 1);
assert(sumList(large) == 500500);
```

---

## Tips for Using These Test Cases

1. **Copy the test code only** - Don't copy the "Test Case X:" headers or point values
2. **Set point values** - Use the suggested point values (10, 15, etc.) or adjust based on your grading scheme
3. **Set visibility** - Mark basic tests as "Visible" and edge cases/advanced tests as "Hidden"
4. **Test incrementally** - Start with visible tests, then add hidden tests
5. **Customize** - Modify these examples to match your specific assignment requirements

---

## Quick Reference

- **Python**: Use `assert` statements directly
- **Java**: Always create `Solution s = new Solution();` first, use `.equals()` for strings
- **C++**: Use `assert()` statements, include `<cmath>` for float comparisons, include `<vector>` for arrays

