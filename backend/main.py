from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
import os

app = FastAPI(title="CropVision API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
models = {}
scaler = None
label_encoder = None
feature_names = []
model_accuracies = {}
confusion_mat = None
crop_distribution = {}
dataset_stats = {}
feature_stats = {}


def train_models():
    global models, scaler, label_encoder, feature_names
    global model_accuracies, confusion_mat, crop_distribution
    global dataset_stats, feature_stats

    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Crop_recommendation_10k.csv")
    df = pd.read_csv(csv_path)

    df.dropna(inplace=True)
    df.drop_duplicates(inplace=True)

    feature_cols = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    feature_names = feature_cols

    dataset_stats = {
        "total_samples": len(df),
        "total_features": len(feature_cols),
        "total_crops": df["label"].nunique(),
        "crop_list": sorted(df["label"].unique().tolist()),
    }

    feature_stats_list = []
    for col in feature_cols:
        feature_stats_list.append({
            "name": col,
            "min": round(float(df[col].min()), 2),
            "max": round(float(df[col].max()), 2),
            "mean": round(float(df[col].mean()), 2),
            "std": round(float(df[col].std()), 2),
        })
    feature_stats.update({"list": feature_stats_list})

    dist = df["label"].value_counts().to_dict()
    crop_distribution.update({k: int(v) for k, v in dist.items()})

    X = df.drop("label", axis=1)
    y = df["label"]

    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    rf = RandomForestClassifier(random_state=42, n_estimators=150)
    rf.fit(X_train_scaled, y_train)
    rf_pred = rf.predict(X_test_scaled)
    rf_acc = accuracy_score(y_test, rf_pred)

    lr = LogisticRegression(max_iter=500, random_state=42)
    lr.fit(X_train_scaled, y_train)
    lr_pred = lr.predict(X_test_scaled)
    lr_acc = accuracy_score(y_test, lr_pred)

    models["random_forest"] = rf
    models["logistic_regression"] = lr

    model_accuracies.update({
        "random_forest": round(rf_acc, 4),
        "logistic_regression": round(lr_acc, 4),
    })

    cm = confusion_matrix(y_test, rf_pred)
    confusion_mat = cm.tolist()

    importances = rf.feature_importances_
    dataset_stats["feature_importances"] = {
        feature_cols[i]: round(float(importances[i]), 4)
        for i in range(len(feature_cols))
    }

    print(f"Models trained on 10K dataset! RF: {rf_acc:.4f}, LR: {lr_acc:.4f}")


@app.on_event("startup")
def startup():
    train_models()


class CropInput(BaseModel):
    N: float
    P: float
    K: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float


@app.get("/")
def root():
    return {"status": "ok", "message": "CropVision API v2"}


@app.get("/api/stats")
def get_stats():
    return {
        "dataset": dataset_stats,
        "accuracies": model_accuracies,
        "crop_distribution": crop_distribution,
        "feature_stats": feature_stats.get("list", []),
    }


@app.get("/api/confusion-matrix")
def get_confusion_matrix():
    return {
        "matrix": confusion_mat,
        "labels": label_encoder.classes_.tolist(),
    }


@app.get("/api/feature-importances")
def get_feature_importances():
    return dataset_stats.get("feature_importances", {})


@app.post("/api/predict")
def predict(data: CropInput):
    input_array = np.array([[data.N, data.P, data.K, data.temperature, data.humidity, data.ph, data.rainfall]])
    input_scaled = scaler.transform(input_array)

    results = []
    for model_name, model in models.items():
        pred = model.predict(input_scaled)[0]
        proba = model.predict_proba(input_scaled)[0]
        crop_name = label_encoder.inverse_transform([pred])[0]
        confidence = float(np.max(proba))

        top_indices = np.argsort(proba)[-5:][::-1]
        top_probs = {}
        for idx in top_indices:
            c = label_encoder.inverse_transform([idx])[0]
            top_probs[c] = round(float(proba[idx]) * 100, 2)

        results.append({
            "model": model_name.replace("_", " ").title(),
            "predicted_crop": crop_name,
            "confidence": round(confidence * 100, 2),
            "top_predictions": top_probs,
        })

    return {"predictions": results}
