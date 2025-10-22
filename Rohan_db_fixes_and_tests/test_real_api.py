#!/usr/bin/env python3
"""
Test the actual running API server (not TestClient)
This simulates what the frontend does
"""
import requests
import json

def test_real_api():
    print("=" * 70)
    print("Testing REAL API Server")
    print("=" * 70)
    print("\nMake sure the backend server is running:")
    print("  cd backend && uvicorn app.api.main:app --reload")
    print("\nPress Enter to continue...")
    input()
    
    base_url = "http://localhost:8000"
    
    # Test 1: Check if server is running
    print("\n1. Checking if server is running...")
    try:
        response = requests.get(f"{base_url}/api/v1/courses")
        print(f"   ✓ Server is responding (Status: {response.status_code})")
    except Exception as e:
        print(f"   ✗ Server is not responding: {e}")
        return
    
    # Test 2: Create a course with proper headers (simulating frontend)
    print("\n2. Creating course via real API...")
    print("   Simulating frontend request with headers:")
    print("   - X-User-Id: 301")
    print("   - X-User-Role: faculty")
    
    headers = {
        "Content-Type": "application/json",
        "X-User-Id": "301",
        "X-User-Role": "faculty"
    }
    
    payload = {
        "course_tag": "REAL-API-TEST",
        "name": "Real API Test Course",
        "description": "Testing via actual HTTP request"
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/v1/courses",
            headers=headers,
            json=payload
        )
        
        print(f"\n   Response Status: {response.status_code}")
        
        if response.status_code == 201:
            course_data = response.json()
            print(f"   ✓ Course created!")
            print(f"   Course ID: {course_data['id']}")
            print(f"   Course Tag: {course_data['course_tag']}")
            
            course_id = course_data['id']
            
            # Test 3: Check if association was created
            print("\n3. Checking faculty course list...")
            response = requests.get(
                f"{base_url}/api/v1/courses/faculty/301",
                headers=headers
            )
            
            if response.status_code == 200:
                courses = response.json()
                course_tags = [c['course_tag'] for c in courses]
                
                if "REAL-API-TEST" in course_tags:
                    print(f"   ✓ Course appears in faculty list!")
                    print(f"   Total faculty courses: {len(courses)}")
                else:
                    print(f"   ✗ Course NOT in faculty list!")
                    print(f"   Found courses: {course_tags}")
            else:
                print(f"   ✗ Error fetching faculty courses: {response.status_code}")
                
        elif response.status_code == 409:
            print(f"   Course already exists (conflict)")
        else:
            print(f"   ✗ Failed to create course")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\n" + "=" * 70)

if __name__ == "__main__":
    test_real_api()

