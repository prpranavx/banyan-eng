import modal
from typing import Dict, Optional
import subprocess
import tempfile
import os
import sys
import resource

app = modal.App("code-executor")

# Constants
MAX_OUTPUT_LENGTH = 10_000  # 10KB max output
MAX_CPU_SECONDS = 2  # 2 seconds CPU time limit
MAX_MEMORY_MB = 256  # 256MB memory limit

def set_resource_limits():
    """Set CPU and memory limits for code execution"""
    # CPU time limit (soft and hard both set to MAX_CPU_SECONDS)
    resource.setrlimit(resource.RLIMIT_CPU, (MAX_CPU_SECONDS, MAX_CPU_SECONDS))
    # Memory limit (address space) in bytes
    memory_bytes = MAX_MEMORY_MB * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))

def truncate_output(text: str, max_len: int = MAX_OUTPUT_LENGTH) -> str:
    """Truncate output if it exceeds max length"""
    if len(text) > max_len:
        return text[:max_len] + f"\n... (truncated, {len(text) - max_len} more characters)"
    return text

# ---------- Images ----------
python_image = modal.Image.debian_slim()
node_image = modal.Image.debian_slim().apt_install("nodejs", "npm")
c_image = modal.Image.debian_slim().apt_install("gcc", "g++")
api_image = modal.Image.debian_slim().pip_install("fastapi")

# ---------- Python ----------
@app.function(image=python_image, timeout=30)
def run_python(code: str, stdin: Optional[str] = None) -> Dict:
    set_resource_limits()
    
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
        f.write(code)
        path = f.name

    try:
        result = subprocess.run(
            [sys.executable, path],
            capture_output=True,
            text=True,
            timeout=25,
            input=stdin if stdin else None,
        )
    finally:
        os.unlink(path)

    return {
        "output": truncate_output(result.stdout),
        "error": truncate_output(result.stderr),
        "success": result.returncode == 0
    }

# ---------- JavaScript ----------
@app.function(image=node_image, timeout=30)
def run_js(code: str, stdin: Optional[str] = None) -> Dict:
    set_resource_limits()
    
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(code)
        path = f.name

    try:
        result = subprocess.run(
            ["node", path],
            capture_output=True,
            text=True,
            timeout=25,
            input=stdin if stdin else None,
        )
    finally:
        os.unlink(path)

    return {
        "output": truncate_output(result.stdout),
        "error": truncate_output(result.stderr),
        "success": result.returncode == 0
    }

# ---------- C ----------
@app.function(image=c_image, timeout=45)
def run_c(code: str, stdin: Optional[str] = None) -> Dict:
    set_resource_limits()
    
    with tempfile.NamedTemporaryFile("w", suffix=".c", delete=False) as f:
        f.write(code)
        src = f.name

    exe = src + ".out"
    
    try:
        compile_res = subprocess.run(
            ["gcc", src, "-O2", "-o", exe],
            capture_output=True,
            text=True,
            timeout=20,
        )

        if compile_res.returncode != 0:
            return {
                "output": "",
                "error": truncate_output(compile_res.stderr),
                "success": False
            }

        run_res = subprocess.run(
            [exe],
            capture_output=True,
            text=True,
            timeout=20,
            input=stdin if stdin else None,
        )

        return {
            "output": truncate_output(run_res.stdout),
            "error": truncate_output(run_res.stderr),
            "success": run_res.returncode == 0
        }
    finally:
        if os.path.exists(src):
            os.unlink(src)
        if os.path.exists(exe):
            os.unlink(exe)

# ---------- C++ ----------
@app.function(image=c_image, timeout=45)
def run_cpp(code: str, stdin: Optional[str] = None) -> Dict:
    set_resource_limits()
    
    with tempfile.NamedTemporaryFile("w", suffix=".cpp", delete=False) as f:
        f.write(code)
        src = f.name

    exe = src + ".out"
    
    try:
        compile_res = subprocess.run(
            ["g++", src, "-O2", "-o", exe],
            capture_output=True,
            text=True,
            timeout=20,
        )

        if compile_res.returncode != 0:
            return {
                "output": "",
                "error": truncate_output(compile_res.stderr),
                "success": False
            }

        run_res = subprocess.run(
            [exe],
            capture_output=True,
            text=True,
            timeout=20,
            input=stdin if stdin else None,
        )

        return {
            "output": truncate_output(run_res.stdout),
            "error": truncate_output(run_res.stderr),
            "success": run_res.returncode == 0
        }
    finally:
        if os.path.exists(src):
            os.unlink(src)
        if os.path.exists(exe):
            os.unlink(exe)

# ---------- HTTP API ----------
@app.function(image=api_image)
@modal.fastapi_endpoint(method="POST")
def execute(payload: Dict):
    code = payload.get("code", "")
    language = payload.get("language", "")
    stdin = payload.get("stdin")  # Optional stdin input

    if language == "python":
        return run_python.remote(code, stdin)
    if language == "javascript":
        return run_js.remote(code, stdin)
    if language == "c":
        return run_c.remote(code, stdin)
    if language == "cpp":
        return run_cpp.remote(code, stdin)

    return {"output": "", "error": f"Unsupported language: {language}", "success": False}
