"""Explicit leakage checks; missing provenance is never treated as verified."""

from collections.abc import Iterable, Mapping

import pandas as pd

from src.data.dataset_contract import CLASSIFICATION_FEATURES


class LeakageError(ValueError):
    pass


def validate_classification_features(
    features: Iterable[str], *, post_outcome_features: Iterable[str] = ()
) -> tuple[str, ...]:
    """Allow only known snapshot predictors, never label/IDs/derived outputs.

    Being allowed for snapshot experiments does not certify event-time safety.
    Explicitly declared post-outcome fields are refused even if on the allowlist.
    """
    names = tuple(features)
    if not names or len(set(names)) != len(names):
        raise LeakageError("Features must be nonempty and unique")
    forbidden = set(names) - set(CLASSIFICATION_FEATURES)
    forbidden.update(set(names).intersection(post_outcome_features))
    if forbidden:
        raise LeakageError(f"Forbidden or post-outcome features: {sorted(forbidden)}")
    return names


def assert_disjoint_partitions(partitions: Mapping[str, Iterable]) -> None:
    seen = set()
    for name, values in partitions.items():
        values = list(values)
        keys = set(values)
        if not keys or len(keys) != len(values):
            raise LeakageError(f"Partition {name} is empty or has duplicate row keys")
        if seen.intersection(keys):
            raise LeakageError("Row overlap between partitions")
        seen.update(keys)


def assert_no_group_overlap(training_groups: Iterable, held_out_groups: Iterable) -> None:
    """Only applicable when real customer/session keys have been supplied."""
    train = pd.Series(list(training_groups), dtype=object)
    held = pd.Series(list(held_out_groups), dtype=object)
    if train.empty or held.empty or train.isna().any() or held.isna().any():
        raise LeakageError("Group identities must be supplied and nonnull")
    if set(train).intersection(held):
        raise LeakageError("Entity/session overlap between partitions")


def _utc_timestamp(value) -> pd.Timestamp:
    try:
        result = pd.Timestamp(value)
    except (ValueError, TypeError, OverflowError) as exc:
        raise LeakageError("Invalid temporal provenance") from exc
    if pd.isna(result) or result.tzinfo is None:
        raise LeakageError("Temporal provenance must be nonnull and timezone-aware")
    return result.tz_convert("UTC")


def validate_temporal_lineage(
    feature_available_at: pd.DataFrame,
    cutoff: pd.Series,
    target_window_start: pd.Series,
    target_window_end: pd.Series,
) -> None:
    """Fail closed: all feature timestamps <= cutoff, target window > cutoff.

    This checks supplied evidence, not its truthfulness. It cannot be called on
    the original CSV because that file contains none of these timestamps.
    """
    if feature_available_at.empty or not feature_available_at.index.is_unique:
        raise LeakageError("Temporal evidence must have unique sample keys")
    validate_classification_features(feature_available_at.columns)
    for values in (cutoff, target_window_start, target_window_end):
        if not values.index.equals(feature_available_at.index):
            raise LeakageError("Temporal evidence sample keys/order do not match")
    for position in range(len(feature_available_at)):
        boundary = _utc_timestamp(cutoff.iloc[position])
        start = _utc_timestamp(target_window_start.iloc[position])
        end = _utc_timestamp(target_window_end.iloc[position])
        if start <= boundary or end <= start:
            raise LeakageError("Target window must start after cutoff and have positive duration")
        for available_at in feature_available_at.iloc[position]:
            if _utc_timestamp(available_at) > boundary:
                raise LeakageError("Feature was available after cutoff")
