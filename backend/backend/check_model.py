import sys
from ultralytics import YOLO

model_path = sys.argv[1] if len(sys.argv) > 1 else "best.pt"
model = YOLO(model_path)

print("=" * 50)
print(f"Model: {model_path}")
print(f"Task : {model.task}")
print(f"Total classes: {len(model.names)}")
print("=" * 50)
print("Class ID -> Nama Class:")
for cls_id, cls_name in model.names.items():
    print(f"  [{cls_id:3d}] {cls_name}")
print("=" * 50)