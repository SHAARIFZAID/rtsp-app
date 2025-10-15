
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
import subprocess
import os
import threading
import shutil
import time
import signal
import atexit

# --- App and Database Setup ---
app = Flask(__name__)
CORS(app)

MONGO_URI = "mongodb+srv://shaarifzaid2125_db_user:ILutMPvUepQM9SwX@cluster0.aupr3nu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

try:
    client = MongoClient(MONGO_URI)
    db = client.get_database("rtsp_overlays")
    overlays_collection = db.overlays
    client.admin.command('ping')
    print("✅ MongoDB connection successful.")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")

# ... (stop_ffmpeg and other helper functions remain the same) ...
ffmpeg_process = None
STREAM_OUTPUT_DIR = "hls_stream"

def stop_ffmpeg():
    global ffmpeg_process
    if ffmpeg_process:
        print("Stopping existing ffmpeg process...")
        try:
            # os.killpg is used to stop the entire process group started by subprocess.Popen with preexec_fn=os.setsid
            os.killpg(os.getpgid(ffmpeg_process.pid), signal.SIGTERM) 
            ffmpeg_process.wait(timeout=5)
            print("ffmpeg process stopped.")
        except (ProcessLookupError, OSError):
            print("ffmpeg process was already stopped or did not exist.")
        except Exception as e:
            print(f"Error while stopping ffmpeg process: {e}")
        finally:
            ffmpeg_process = None
    if os.path.exists(STREAM_OUTPUT_DIR):
        try:
            shutil.rmtree(STREAM_OUTPUT_DIR)
            print(f"Cleaned up {STREAM_OUTPUT_DIR} directory.")
        except Exception as e:
            print(f"Error cleaning up {STREAM_OUTPUT_DIR}: {e}")

atexit.register(stop_ffmpeg)

def serialize_overlay(overlay):
    if '_id' in overlay:
        overlay['_id'] = str(overlay['_id'])
    return overlay
# --- API Routes for Overlays ---

@app.route('/api/overlays', methods=['GET'])
def get_overlays():
    try:
        all_overlays = list(overlays_collection.find())
        return jsonify([serialize_overlay(o) for o in all_overlays]), 200
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve overlays: {e}"}), 500

@app.route('/api/overlays', methods=['POST'])
def create_overlay():
    try:
        data = request.get_json()
        if not data or 'type' not in data or 'content' not in data:
            return jsonify({"error": "Missing required fields"}), 400

        # Add default position/size if not provided
        if 'x' not in data: data['x'] = 50
        if 'y' not in data: data['y'] = 50
        if 'width' not in data: data['width'] = 200
        if 'height' not in data: data['height'] = 50

        # --- NEW: Add default style properties for text overlays ---
        if data['type'] == 'text':
            if 'fontSize' not in data: data['fontSize'] = '24px'
            if 'color' not in data: data['color'] = '#FFFFFF'
            if 'fontWeight' not in data: data['fontWeight'] = 'bold'
            if 'textShadow' not in data: data['textShadow'] = '2px 2px 4px rgba(0,0,0,0.7)'
        
        result = overlays_collection.insert_one(data)
        new_overlay = overlays_collection.find_one({"_id": result.inserted_id})
        return jsonify(serialize_overlay(new_overlay)), 201
    except Exception as e:
        return jsonify({"error": f"Failed to create overlay: {e}"}), 500

@app.route('/api/overlays/<id>', methods=['PUT'])
def update_overlay(id):
    try:
        data = request.get_json()
        data.pop('_id', None)
        result = overlays_collection.update_one({"_id": ObjectId(id)}, {"$set": data})
        if result.matched_count == 0:
            return jsonify({"error": "Overlay not found"}), 404
        updated_overlay = overlays_collection.find_one({"_id": ObjectId(id)})
        return jsonify(serialize_overlay(updated_overlay)), 200
    except Exception as e:
        return jsonify({"error": f"Failed to update overlay: {e}"}), 400

@app.route('/api/overlays/<id>', methods=['DELETE'])
def delete_overlay(id):
    try:
        result = overlays_collection.delete_one({"_id": ObjectId(id)})
        if result.deleted_count == 0:
            return jsonify({"error": "Overlay not found"}), 404
        return jsonify({"message": f"Overlay {id} deleted"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to delete overlay: {e}"}), 400

# ... (Streaming routes remain the same) ...
@app.route('/api/start_rtsp', methods=['POST'])
def start_rtsp_stream():
    global ffmpeg_process
    rtsp_url = "test.mp4"
    if not os.path.exists(rtsp_url):
        # NOTE: Make sure 'test.mp4' is in the backend/ directory or adjust this path!
        return jsonify({"error": "test.mp4 not found in backend directory"}), 404
    stop_ffmpeg()
    os.makedirs(STREAM_OUTPUT_DIR, exist_ok=True)
    ffmpeg_command = [
        "ffmpeg", "-re", "-i", rtsp_url, "-c:v", "libx264", "-preset", "veryfast", "-g", "50", "-crf", "23",
        "-c:a", "aac", "-ac", "1", "-b:a", "128k", "-f", "hls", "-hls_time", "2", "-hls_list_size", "3",
        "-hls_flags", "delete_segments", "-start_number", "1", os.path.join(STREAM_OUTPUT_DIR, "stream.m3u8")
    ]
    def run_ffmpeg_in_thread():
        global ffmpeg_process
        print(f"Starting ffmpeg with command: {' '.join(ffmpeg_command)}")
        try:
            ffmpeg_process = subprocess.Popen(
                ffmpeg_command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid
            )
        except Exception as e:
            print(f"Error launching ffmpeg process: {e}")
    threading.Thread(target=run_ffmpeg_in_thread).start()
    time.sleep(2)
    
    # 🌟 CRITICAL FIX: Use the public Render URL instead of 127.0.0.1
    # Check for the Render-provided environment variable first, then fallback to hardcoded URL
    base_url = os.environ.get('RENDER_EXTERNAL_URL')
    
    # Fallback if the environment variable is not set (e.g., running locally or variable name changed)
    if not base_url:
        # Use your specific Render subdomain from the dashboard
        base_url = "https://rtsp-app.onrender.com" 

    hls_url = f"{base_url}/{STREAM_OUTPUT_DIR}/stream.m3u8"
    
    # Ensure the URL uses HTTPS if not already present
    if not hls_url.startswith("https://") and not hls_url.startswith("http://"):
         hls_url = "https://" + hls_url
    elif hls_url.startswith("http://"):
         hls_url = hls_url.replace("http://", "https://")
         
    return jsonify({"message": "RTSP stream started", "hls_url": hls_url}), 200

@app.route('/api/stop_rtsp', methods=['POST'])
def stop_rtsp_stream():
    stop_ffmpeg()
    return jsonify({"message": "RTSP stream stopped and cleaned up"}), 200

@app.route(f'/{STREAM_OUTPUT_DIR}/<path:filename>')
def serve_hls_files(filename):
    # This route correctly serves the files from the hls_stream directory
    return send_from_directory(STREAM_OUTPUT_DIR, filename)

if __name__ == '__main__':
    app.run(debug=True, port=5001, use_reloader=False)
