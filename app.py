import os
import math
from flask import Flask, render_template, request, jsonify



app = Flask(__name__)



@app.route("/")
def index():
    return render_template("index.html")




@app.route("/calculate", methods=["POST"])
def calculate():
    data = request.get_json()
    expression = data.get("expression", "").strip()

    if not expression:
        return jsonify({"result": "0", "status": "error"})

    try:
        safe_globals = {"__builtins__": {}}
        safe_locals = {k: v for k, v in math.__dict__.items() if not k.startswith("__")}
        result = eval(expression, safe_globals, safe_locals)  # noqa: S307

        # Format result: remove trailing zeros for floats
        if isinstance(result, float):
            if result == int(result):
                result = int(result)
            else:
                result = round(result, 10)

        return jsonify({"result": str(result), "status": "success"})

    except ZeroDivisionError:
        return jsonify({"result": "Cannot ÷ by 0", "status": "error"})
    except Exception:
        return jsonify({"result": "Error", "status": "error"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))  # ← match the Dockerfile fallback
    app.run(host="0.0.0.0", port=port, debug=False)
