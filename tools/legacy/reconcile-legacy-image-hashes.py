"""Reconcile legacy-site product images against embedded source-workbook images.

Evidence chain:
legacy downloaded image SHA-256 -> identical XLSX embedded media bytes ->
worksheet anchor -> source row/block -> Bowen No. -> current product_id.

This script never uses visual similarity and does not modify the prototype.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[2]
RAW_XLSX = ROOT / "data" / "raw" / "产品信息表1(1).xlsx"
STAGING = ROOT / "data" / "derived" / "v2" / "staging-records.json"
PRODUCTS = ROOT / "data" / "derived" / "v2" / "products.json"
MATCHING = ROOT / "data" / "legacy-site" / "product-image-matching.json"
TITLE_EVIDENCE = ROOT / "data" / "legacy-site" / "drawing-title-evidence.json"
OUTPUT = ROOT / "data" / "legacy-site" / "product-image-reconciliation.json"


CN_CATEGORY_TO_TYPE = {
    "节温器": "Thermostat",
    "热敏开关": "ThermalSwitch",
    "刹车灯开关": "BrakeLightSwitch",
    "倒车灯开关": "ReverseLightSwitch",
    "水温度传感器": "TemperatureSensor",
    "机油压力报警器": "OilPressureWarningSwitch",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def nearest_source_record(records, anchor_col: int):
    """Return a unique row/block record nearest to an image anchor column."""
    scored = []
    for record in records:
        block_col = int(record.get("source_block_start_col") or 1)
        # Most catalog sheets place the picture one column after block start;
        # 工作表1 places it at the block start. Accept the closer convention.
        distance = min(abs(anchor_col - block_col), abs(anchor_col - (block_col + 1)))
        scored.append((distance, block_col, record))
    if not scored:
        return None, "no_source_record"
    scored.sort(key=lambda item: (item[0], item[1]))
    best_distance = scored[0][0]
    tied = [item for item in scored if item[0] == best_distance]
    if len(tied) != 1 or best_distance > 2:
        return None, "ambiguous_anchor"
    return tied[0][2], "unique_anchor"


def main() -> None:
    staging = read_json(STAGING)
    products = read_json(PRODUCTS)
    matching = read_json(MATCHING)
    title_evidence = read_json(TITLE_EVIDENCE) if TITLE_EVIDENCE.exists() else {"review_rows": []}

    products_by_bowen = {str(item.get("bowen_no") or ""): item for item in products}
    records_by_sheet_row = defaultdict(list)
    for record in staging:
        records_by_sheet_row[(record["source_sheet"], int(record["source_row"]))].append(record)

    hash_sources = defaultdict(list)
    workbook = openpyxl.load_workbook(RAW_XLSX, data_only=True)
    embedded_count = 0
    for sheet in workbook.worksheets:
        for image in getattr(sheet, "_images", []):
            embedded_count += 1
            anchor = image.anchor._from
            row = int(anchor.row) + 1
            col = int(anchor.col) + 1
            record, anchor_status = nearest_source_record(records_by_sheet_row[(sheet.title, row)], col)
            image_hash = sha256(image._data())
            evidence = {
                "source_sheet": sheet.title,
                "source_row": row,
                "image_anchor_col": col,
                "anchor_status": anchor_status,
                "source_record_id": record.get("source_record_id") if record else None,
                "source_block_start_col": record.get("source_block_start_col") if record else None,
                "bowen_no": str(record.get("bowen_no") or "") if record else "",
                "product_id": None,
            }
            if record:
                product = products_by_bowen.get(str(record.get("bowen_no") or ""))
                if product:
                    evidence["product_id"] = product["product_id"]
                    evidence["product_type"] = product.get("product_type")
                    evidence["product_name_en"] = product.get("product_name_en")
            hash_sources[image_hash].append(evidence)

    title_by_image = {
        row["image_url"]: row
        for row in title_evidence.get("review_rows", [])
        if row.get("candidate_product_id")
    }

    reconciled = []
    for row in matching["image_rows"]:
        if row.get("reuse_status") != "review_required":
            continue

        source_candidates = hash_sources.get(row.get("image_sha256") or "", [])
        valid_source_candidates = [item for item in source_candidates if item.get("product_id")]
        product_ids = sorted({item["product_id"] for item in valid_source_candidates})
        exact = valid_source_candidates[0] if len(product_ids) == 1 else None
        title = title_by_image.get(row.get("image_url") or "")

        exact_product_id = exact.get("product_id") if exact else ""
        title_product_id = title.get("candidate_product_id") if title else ""
        expected_type = CN_CATEGORY_TO_TYPE.get(row.get("product_name_zh") or "")
        is_product_category = bool(expected_type)

        candidate_product_id = ""
        candidate_bowen_no = ""
        evidence_level = ""
        decision = "review_required"
        reason = ""

        exact_bowen = str(exact.get("bowen_no") or "").upper() if exact else ""
        title_bowen = str(title.get("candidate_bowen_no") or "").upper() if title else ""
        exact_is_specific_variant = bool(
            exact_product_id
            and title_product_id
            and exact_product_id != title_product_id
            and title_bowen
            and exact_bowen.startswith(title_bowen)
            and len(exact_bowen) > len(title_bowen)
        )

        if not is_product_category and row.get("product_name_zh") != "马6芯":
            evidence_level = "not_product_asset"
            decision = "not_applicable"
            reason = "该页面属于证书、工厂或公司素材，不需要映射到产品数据库"
        elif exact_product_id and title_product_id and exact_product_id == title_product_id:
            candidate_product_id = exact_product_id
            candidate_bowen_no = str(exact.get("bowen_no") or "")
            evidence_level = "two_independent_exact_sources"
            decision = "auto_match"
            reason = "旧站图片与原始Excel内嵌图片SHA-256完全一致，且网页原始文件名给出同一Bowen编号"
        elif exact_product_id and not title_product_id:
            candidate_product_id = exact_product_id
            candidate_bowen_no = str(exact.get("bowen_no") or "")
            evidence_level = "exact_image_bytes_to_source_cell"
            decision = "auto_match"
            reason = "旧站图片与原始Excel内嵌图片SHA-256完全一致，并由图片锚点回溯到唯一Bowen编号"
        elif title_product_id and not exact_product_id:
            candidate_product_id = title_product_id
            candidate_bowen_no = str(title.get("candidate_bowen_no") or "")
            evidence_level = "original_filename_plus_category"
            decision = "auto_match"
            reason = "旧站正文图原始文件名精确给出Bowen编号，且旧站品类与当前数据库一致"
        elif exact_product_id and title_product_id and exact_product_id != title_product_id:
            if exact_is_specific_variant:
                candidate_product_id = exact_product_id
                candidate_bowen_no = exact_bowen
                evidence_level = "exact_variant_over_generic_filename"
                decision = "auto_match"
                reason = "原始文件名只给出产品族基础编号；字节完全一致的Excel源图指向更具体的Bowen变体编号"
            else:
                evidence_level = "conflict"
                reason = f"图片哈希证据指向{exact_product_id}，文件名证据指向{title_product_id}"
        elif len(product_ids) > 1:
            evidence_level = "duplicate_source_image"
            reason = "同一图片字节在原始Excel中对应多个产品，不能唯一绑定"
        else:
            evidence_level = "no_structured_match"
            reason = "没有可核对的文件名编号或原始Excel字节级匹配"

        product = next((p for p in products if p.get("product_id") == candidate_product_id), None)
        category_check = "not_checkable"
        if product and expected_type and product.get("product_type"):
            category_check = "agree" if product["product_type"] == expected_type else "conflict"
            if category_check == "conflict":
                decision = "review_required"
                reason += "；旧站品类与当前数据库产品类型冲突"

        reconciled.append({
            **row,
            "reconciled_product_id": candidate_product_id or None,
            "reconciled_bowen_no": candidate_bowen_no or None,
            "reconciled_product_name_en": product.get("product_name_en") if product else None,
            "reconciled_product_type": product.get("product_type") if product else None,
            "reconciled_website_category": product.get("website_category") if product else None,
            "reconciliation_status": decision,
            "evidence_level": evidence_level,
            "category_check": category_check,
            "reconciliation_reason": reason,
            "exact_hash_candidate_product_ids": product_ids,
            "exact_hash_source_cells": valid_source_candidates,
            "filename_candidate_product_id": title_product_id or None,
        })

    auto_rows = [row for row in reconciled if row["reconciliation_status"] == "auto_match"]
    review_rows = [row for row in reconciled if row["reconciliation_status"] == "review_required"]
    not_applicable_rows = [row for row in reconciled if row["reconciliation_status"] == "not_applicable"]
    auto_pages = {row["legacy_page_id"] for row in auto_rows}
    review_pages = {row["legacy_page_id"] for row in review_rows}
    conflicts = [row for row in reconciled if row["evidence_level"] == "conflict" or row["category_check"] == "conflict"]

    result = {
        "method": "SHA-256 exact image bytes -> XLSX embedded image anchor -> source record -> Bowen No.; cross-checked with old-site original filename and category",
        "never_used": "No visual similarity, OCR guess, page-order guess, or title-only category guess",
        "inputs": {
            "raw_xlsx": str(RAW_XLSX.relative_to(ROOT)).replace("\\", "/"),
            "staging_records": str(STAGING.relative_to(ROOT)).replace("\\", "/"),
            "products": str(PRODUCTS.relative_to(ROOT)).replace("\\", "/"),
            "phase35_matching": str(MATCHING.relative_to(ROOT)).replace("\\", "/"),
            "drawing_title_evidence": str(TITLE_EVIDENCE.relative_to(ROOT)).replace("\\", "/"),
        },
        "stats": {
            "source_workbook_embedded_images": embedded_count,
            "review_required_image_rows_before": len(reconciled),
            "auto_matched_image_rows_after": len(auto_rows),
            "review_required_image_rows_after": len(review_rows),
            "not_applicable_company_asset_rows": len(not_applicable_rows),
            "auto_matched_unique_pages_after": len(auto_pages),
            "review_required_unique_pages_after": len(review_pages),
            "conflict_rows": len(conflicts),
            "evidence_levels": dict(sorted(__import__("collections").Counter(row["evidence_level"] for row in reconciled).items())),
        },
        "rows": reconciled,
    }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
