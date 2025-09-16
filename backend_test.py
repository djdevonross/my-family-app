#!/usr/bin/env python3
"""
Backend Test Suite for My Family App
Tests all backend endpoints systematically with real family data
"""

import requests
import json
import base64
from datetime import datetime, timedelta
import os
from pathlib import Path

# Load backend URL from frontend .env
def load_backend_url():
    frontend_env_path = Path("/app/frontend/.env")
    if frontend_env_path.exists():
        with open(frontend_env_path, 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    return "https://myfamily-app.preview.emergentagent.com"

BASE_URL = load_backend_url()
API_URL = f"{BASE_URL}/api"

print(f"Testing backend at: {API_URL}")

class FamilyBackendTester:
    def __init__(self):
        self.tokens = {}
        self.users = {}
        self.test_results = {
            'auth': {'passed': 0, 'failed': 0, 'details': []},
            'events': {'passed': 0, 'failed': 0, 'details': []},
            'notes': {'passed': 0, 'failed': 0, 'details': []},
            'chat': {'passed': 0, 'failed': 0, 'details': []},
            'users': {'passed': 0, 'failed': 0, 'details': []}
        }
        
    def log_result(self, category, test_name, success, details=""):
        if success:
            self.test_results[category]['passed'] += 1
            status = "✅ PASS"
        else:
            self.test_results[category]['failed'] += 1
            status = "❌ FAIL"
        
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        
        self.test_results[category]['details'].append(result)
        print(result)
    
    def test_health_check(self):
        """Test basic API health"""
        print("\n=== TESTING API HEALTH ===")
        try:
            response = requests.get(f"{API_URL}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ API Health Check: {data.get('message', 'OK')}")
                return True
            else:
                print(f"❌ API Health Check Failed: Status {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ API Health Check Failed: {str(e)}")
            return False
    
    def test_authentication(self):
        """Test authentication for all family members"""
        print("\n=== TESTING AUTHENTICATION ===")
        
        family_members = [
            {"username": "pai", "name": "Pai", "password": "familia123"},
            {"username": "mae", "name": "Mãe", "password": "familia123"},
            {"username": "filho1", "name": "João", "password": "familia123"},
            {"username": "filha1", "name": "Maria", "password": "familia123"},
            {"username": "avo", "name": "Avó", "password": "familia123"}
        ]
        
        for member in family_members:
            try:
                # Test login
                login_data = {
                    "username": member["username"],
                    "password": member["password"]
                }
                
                response = requests.post(f"{API_URL}/auth/login", json=login_data, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    token = data.get("access_token")
                    user_info = data.get("user")
                    
                    if token and user_info:
                        self.tokens[member["username"]] = token
                        self.users[member["username"]] = user_info
                        self.log_result('auth', f"Login {member['username']}", True, 
                                      f"Token received, user: {user_info.get('name')}")
                        
                        # Test /auth/me endpoint
                        headers = {"Authorization": f"Bearer {token}"}
                        me_response = requests.get(f"{API_URL}/auth/me", headers=headers, timeout=10)
                        
                        if me_response.status_code == 200:
                            me_data = me_response.json()
                            self.log_result('auth', f"Get profile {member['username']}", True,
                                          f"Profile: {me_data.get('name')}")
                        else:
                            self.log_result('auth', f"Get profile {member['username']}", False,
                                          f"Status: {me_response.status_code}")
                    else:
                        self.log_result('auth', f"Login {member['username']}", False, "Missing token or user info")
                else:
                    self.log_result('auth', f"Login {member['username']}", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
                    
            except Exception as e:
                self.log_result('auth', f"Login {member['username']}", False, f"Exception: {str(e)}")
    
    def test_users_endpoint(self):
        """Test users listing endpoint"""
        print("\n=== TESTING USERS ENDPOINT ===")
        
        if not self.tokens:
            self.log_result('users', "Get users list", False, "No authentication tokens available")
            return
        
        # Use pai's token (admin user)
        token = self.tokens.get('pai')
        if not token:
            self.log_result('users', "Get users list", False, "No pai token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{API_URL}/users", headers=headers, timeout=10)
            
            if response.status_code == 200:
                users = response.json()
                if isinstance(users, list) and len(users) == 5:
                    user_names = [user.get('name') for user in users]
                    self.log_result('users', "Get users list", True, 
                                  f"Found {len(users)} users: {', '.join(user_names)}")
                else:
                    self.log_result('users', "Get users list", False, 
                                  f"Expected 5 users, got {len(users) if isinstance(users, list) else 'invalid response'}")
            else:
                self.log_result('users', "Get users list", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_result('users', "Get users list", False, f"Exception: {str(e)}")
    
    def test_events_endpoints(self):
        """Test calendar events CRUD operations"""
        print("\n=== TESTING EVENTS ENDPOINTS ===")
        
        if not self.tokens:
            self.log_result('events', "Events test", False, "No authentication tokens available")
            return
        
        # Test with pai and mae
        test_users = ['pai', 'mae']
        created_events = []
        
        for username in test_users:
            token = self.tokens.get(username)
            if not token:
                continue
                
            headers = {"Authorization": f"Bearer {token}"}
            
            # Create event
            event_data = {
                "title": f"Evento do {username.title()}",
                "description": f"Evento de teste criado pelo {username}",
                "date": (datetime.now() + timedelta(days=1)).isoformat(),
                "color": "#FF5722" if username == 'pai' else "#2196F3",
                "alert_minutes": 30
            }
            
            try:
                response = requests.post(f"{API_URL}/events", json=event_data, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    event = response.json()
                    event_id = event.get('id')
                    if event_id:
                        created_events.append((event_id, username))
                        self.log_result('events', f"Create event ({username})", True, 
                                      f"Event ID: {event_id}, Title: {event.get('title')}")
                    else:
                        self.log_result('events', f"Create event ({username})", False, "No event ID returned")
                else:
                    self.log_result('events', f"Create event ({username})", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
                    
            except Exception as e:
                self.log_result('events', f"Create event ({username})", False, f"Exception: {str(e)}")
        
        # Test getting all events
        if self.tokens.get('pai'):
            try:
                headers = {"Authorization": f"Bearer {self.tokens['pai']}"}
                response = requests.get(f"{API_URL}/events", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    events = response.json()
                    if isinstance(events, list):
                        self.log_result('events', "Get all events", True, 
                                      f"Retrieved {len(events)} events")
                        
                        # Verify our created events are in the list
                        event_ids = [event.get('id') for event in events]
                        for event_id, creator in created_events:
                            if event_id in event_ids:
                                self.log_result('events', f"Verify event exists ({creator})", True, 
                                              f"Event {event_id} found in list")
                            else:
                                self.log_result('events', f"Verify event exists ({creator})", False, 
                                              f"Event {event_id} not found in list")
                    else:
                        self.log_result('events', "Get all events", False, "Invalid response format")
                else:
                    self.log_result('events', "Get all events", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
                    
            except Exception as e:
                self.log_result('events', "Get all events", False, f"Exception: {str(e)}")
        
        # Test deleting events (only by creator)
        for event_id, creator in created_events:
            token = self.tokens.get(creator)
            if not token:
                continue
                
            try:
                headers = {"Authorization": f"Bearer {token}"}
                response = requests.delete(f"{API_URL}/events/{event_id}", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    self.log_result('events', f"Delete event ({creator})", True, 
                                  f"Event {event_id} deleted successfully")
                else:
                    self.log_result('events', f"Delete event ({creator})", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
                    
            except Exception as e:
                self.log_result('events', f"Delete event ({creator})", False, f"Exception: {str(e)}")
    
    def test_notes_endpoints(self):
        """Test notes with images endpoints"""
        print("\n=== TESTING NOTES ENDPOINTS ===")
        
        if not self.tokens:
            self.log_result('notes', "Notes test", False, "No authentication tokens available")
            return
        
        # Create a simple base64 image for testing
        test_image_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        
        # Test with mae
        username = 'mae'
        token = self.tokens.get(username)
        if not token:
            self.log_result('notes', "Notes test", False, f"No token for {username}")
            return
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create note with image
        note_data = {
            "title": "Nota de Teste da Mãe",
            "content": "Esta é uma nota de teste com uma imagem anexada. Criada para testar a funcionalidade de notas da aplicação My Family.",
            "images": [test_image_b64]
        }
        
        try:
            response = requests.post(f"{API_URL}/notes", json=note_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                note = response.json()
                note_id = note.get('id')
                if note_id:
                    self.log_result('notes', f"Create note with image ({username})", True, 
                                  f"Note ID: {note_id}, Title: {note.get('title')}")
                else:
                    self.log_result('notes', f"Create note with image ({username})", False, "No note ID returned")
            else:
                self.log_result('notes', f"Create note with image ({username})", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_result('notes', f"Create note with image ({username})", False, f"Exception: {str(e)}")
        
        # Create note without image (with filho1)
        username2 = 'filho1'
        token2 = self.tokens.get(username2)
        if token2:
            headers2 = {"Authorization": f"Bearer {token2}"}
            
            note_data2 = {
                "title": "Nota do João",
                "content": "Esta é uma nota simples do João, sem imagens.",
                "images": []
            }
            
            try:
                response = requests.post(f"{API_URL}/notes", json=note_data2, headers=headers2, timeout=10)
                
                if response.status_code == 200:
                    note = response.json()
                    self.log_result('notes', f"Create note without image ({username2})", True, 
                                  f"Note ID: {note.get('id')}, Title: {note.get('title')}")
                else:
                    self.log_result('notes', f"Create note without image ({username2})", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
                    
            except Exception as e:
                self.log_result('notes', f"Create note without image ({username2})", False, f"Exception: {str(e)}")
        
        # Test getting all notes
        try:
            response = requests.get(f"{API_URL}/notes", headers=headers, timeout=10)
            
            if response.status_code == 200:
                notes = response.json()
                if isinstance(notes, list):
                    self.log_result('notes', "Get all notes", True, 
                                  f"Retrieved {len(notes)} notes")
                    
                    # Check if notes have proper structure
                    for note in notes:
                        if all(key in note for key in ['id', 'title', 'content', 'created_by', 'created_by_name']):
                            self.log_result('notes', f"Verify note structure", True, 
                                          f"Note '{note.get('title')}' has proper structure")
                        else:
                            self.log_result('notes', f"Verify note structure", False, 
                                          f"Note '{note.get('title')}' missing required fields")
                else:
                    self.log_result('notes', "Get all notes", False, "Invalid response format")
            else:
                self.log_result('notes', "Get all notes", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_result('notes', "Get all notes", False, f"Exception: {str(e)}")
    
    def test_chat_endpoints(self):
        """Test chat messages endpoints"""
        print("\n=== TESTING CHAT ENDPOINTS ===")
        
        if not self.tokens:
            self.log_result('chat', "Chat test", False, "No authentication tokens available")
            return
        
        # Test sending messages from different family members
        test_messages = [
            ("pai", "Olá família! Como estão todos hoje?"),
            ("mae", "Estamos bem! O jantar está quase pronto."),
            ("filho1", "Posso jogar depois do jantar?"),
            ("filha1", "Eu também quero jogar!"),
            ("avo", "Que bom ver a família toda junta! ❤️")
        ]
        
        sent_messages = []
        
        # Send messages
        for username, message_text in test_messages:
            token = self.tokens.get(username)
            if not token:
                continue
                
            headers = {"Authorization": f"Bearer {token}"}
            message_data = {"message": message_text}
            
            try:
                response = requests.post(f"{API_URL}/chat/messages", json=message_data, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    message = response.json()
                    message_id = message.get('id')
                    if message_id:
                        sent_messages.append(message_id)
                        self.log_result('chat', f"Send message ({username})", True, 
                                      f"Message ID: {message_id}, Text: '{message_text[:30]}...'")
                    else:
                        self.log_result('chat', f"Send message ({username})", False, "No message ID returned")
                else:
                    self.log_result('chat', f"Send message ({username})", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
                    
            except Exception as e:
                self.log_result('chat', f"Send message ({username})", False, f"Exception: {str(e)}")
        
        # Test getting all messages
        if self.tokens.get('pai'):
            try:
                headers = {"Authorization": f"Bearer {self.tokens['pai']}"}
                response = requests.get(f"{API_URL}/chat/messages", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    messages = response.json()
                    if isinstance(messages, list):
                        self.log_result('chat', "Get all messages", True, 
                                      f"Retrieved {len(messages)} messages")
                        
                        # Verify message structure and our sent messages
                        our_messages_found = 0
                        for message in messages:
                            if message.get('id') in sent_messages:
                                our_messages_found += 1
                            
                            # Check message structure
                            required_fields = ['id', 'message', 'created_by', 'created_by_name', 'created_by_avatar']
                            if all(field in message for field in required_fields):
                                self.log_result('chat', f"Verify message structure", True, 
                                              f"Message from {message.get('created_by_name')} has proper structure")
                            else:
                                self.log_result('chat', f"Verify message structure", False, 
                                              f"Message missing required fields")
                        
                        if our_messages_found == len(sent_messages):
                            self.log_result('chat', "Verify sent messages in list", True, 
                                          f"All {our_messages_found} sent messages found")
                        else:
                            self.log_result('chat', "Verify sent messages in list", False, 
                                          f"Only {our_messages_found}/{len(sent_messages)} sent messages found")
                    else:
                        self.log_result('chat', "Get all messages", False, "Invalid response format")
                else:
                    self.log_result('chat', "Get all messages", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
                    
            except Exception as e:
                self.log_result('chat', "Get all messages", False, f"Exception: {str(e)}")
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*60)
        print("BACKEND TEST RESULTS SUMMARY")
        print("="*60)
        
        total_passed = 0
        total_failed = 0
        
        for category, results in self.test_results.items():
            passed = results['passed']
            failed = results['failed']
            total_passed += passed
            total_failed += failed
            
            status = "✅ ALL PASS" if failed == 0 else f"❌ {failed} FAILED"
            print(f"\n{category.upper()}: {passed} passed, {failed} failed - {status}")
            
            # Show failed tests details
            if failed > 0:
                print("Failed tests:")
                for detail in results['details']:
                    if "❌ FAIL" in detail:
                        print(f"  {detail}")
        
        print(f"\nOVERALL: {total_passed} passed, {total_failed} failed")
        
        if total_failed == 0:
            print("🎉 ALL BACKEND TESTS PASSED!")
        else:
            print(f"⚠️  {total_failed} TESTS FAILED - NEEDS ATTENTION")
        
        return total_failed == 0

def main():
    """Run all backend tests"""
    print("Starting My Family Backend Test Suite...")
    print(f"Testing against: {API_URL}")
    
    tester = FamilyBackendTester()
    
    # Run health check first
    if not tester.test_health_check():
        print("❌ Backend is not responding. Aborting tests.")
        return False
    
    # Run all test suites
    tester.test_authentication()
    tester.test_users_endpoint()
    tester.test_events_endpoints()
    tester.test_notes_endpoints()
    tester.test_chat_endpoints()
    
    # Print summary
    success = tester.print_summary()
    
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)