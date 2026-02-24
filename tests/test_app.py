import pytest
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_index_loads(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_addition(client):
    resp = client.post("/calculate", json={"expression": "2+3"})
    assert resp.get_json()["result"] == "5"


def test_subtraction(client):
    resp = client.post("/calculate", json={"expression": "10-4"})
    assert resp.get_json()["result"] == "6"


def test_multiplication(client):
    resp = client.post("/calculate", json={"expression": "6*7"})
    assert resp.get_json()["result"] == "42"


def test_division(client):
    resp = client.post("/calculate", json={"expression": "10/4"})
    assert resp.get_json()["result"] == "2.5"


def test_division_by_zero(client):
    resp = client.post("/calculate", json={"expression": "5/0"})
    assert resp.get_json()["status"] == "error"


def test_complex_expression(client):
    resp = client.post("/calculate", json={"expression": "(2+3)*4"})
    assert resp.get_json()["result"] == "20"


def test_empty_expression(client):
    resp = client.post("/calculate", json={"expression": ""})
    assert resp.get_json()["status"] == "error"
