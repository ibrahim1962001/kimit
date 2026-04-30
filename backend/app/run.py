#!/usr/bin/env python3
"""
DataPath Analyzer - Startup Script
تشغيل أداة تحليل البيانات
"""

import os
import sys
import subprocess

def check_python():
    """Check if Python is installed."""
    try:
        version = sys.version_info
        print(f"✅ Python {version.major}.{version.minor}.{version.micro} detected")
        return True
    except:
        print("❌ Python not found")
        return False

def check_dependencies():
    """Check and install dependencies."""
    print("\n📦 Checking dependencies...")
    
    try:
        import fastapi
        import pandas
        import numpy
        import openpyxl
        import groq
        import chardet
        print("✅ All dependencies are installed")
        return True
    except ImportError as e:
        print(f"⚠️  Missing dependency: {e}")
        print("📥 Installing dependencies...")
        
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", "-r", 
                os.path.join(os.path.dirname(os.path.dirname(__file__)), "requirements.txt")
            ])
            print("✅ Dependencies installed successfully")
            return True
        except:
            print("❌ Failed to install dependencies")
            return False

def start_server():
    """Start the FastAPI server."""
    print("\n🚀 Starting DataPath Analyzer Server...")
    print("=" * 50)
    print("📊 DataPath Analyzer")
    print("🌐 URL: http://localhost:8000")
    print("📖 API Docs: http://localhost:8000/docs")
    print("=" * 50)
    print("\n⏳ Server is starting...")
    print("💡 Press Ctrl+C to stop the server\n")
    
    try:
        import uvicorn
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped")
    except Exception as e:
        print(f"\n❌ Server error: {e}")
        print("💡 Make sure port 8000 is not in use")

def main():
    """Main entry point."""
    print("=" * 50)
    print("📊 DataPath Analyzer - أداة تحليل البيانات")
    print("=" * 50 + "\n")
    
    # Check Python
    if not check_python():
        input("\nPress Enter to exit...")
        sys.exit(1)
    
    # Change to backend directory (root of the backend)
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # Check dependencies
    if not check_dependencies():
        input("\nPress Enter to exit...")
        sys.exit(1)
    
    # Start server
    start_server()

if __name__ == "__main__":
    main()
