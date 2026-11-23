"""Stable sample payloads displayed in Swagger for the product demo."""


DEMO_BEHAVIOR = {
    "source": "video-demo",
    "Age": 43.0,
    "Gender": "Male",
    "Country": "France",
    "City": "Marseille",
    "Membership_Years": 2.9,
    "Login_Frequency": 14.0,
    "Session_Duration_Avg": 27.4,
    "Pages_Per_Session": 6.0,
    "Cart_Abandonment_Rate": 50.6,
    "Wishlist_Items": 3.0,
    "Total_Purchases": 9.0,
    "Average_Order_Value": 94.72,
    "Days_Since_Last_Purchase": 34.0,
    "Discount_Usage_Rate": 46.4,
    "Returns_Rate": 2.0,
    "Email_Open_Rate": 17.9,
    "Customer_Service_Calls": 9.0,
    "Product_Reviews_Written": 4.0,
    "Social_Media_Engagement_Score": 16.3,
    "Mobile_App_Usage": 20.8,
    "Payment_Method_Diversity": 1.0,
    "Lifetime_Value": 953.33,
    "Credit_Balance": 2278.0,
    "Churned": False,
    "Signup_Quarter": "Q1",
}


DEMO_XGBOOST_CUSTOMER = {
    key: value
    for key, value in DEMO_BEHAVIOR.items()
    if key not in {"source", "Total_Purchases"}
}
DEMO_XGBOOST_CUSTOMER["Churned"] = 0


DEMO_KMEANS_CUSTOMER = {
    key: DEMO_BEHAVIOR[key]
    for key in (
        "Login_Frequency",
        "Session_Duration_Avg",
        "Pages_Per_Session",
        "Cart_Abandonment_Rate",
        "Wishlist_Items",
        "Total_Purchases",
        "Average_Order_Value",
        "Days_Since_Last_Purchase",
        "Discount_Usage_Rate",
        "Mobile_App_Usage",
    )
}


DEMO_XGBOOST_REQUEST = {
    "customer": DEMO_XGBOOST_CUSTOMER,
    "save_result": False,
    "customer_id": None,
    "behavior_snapshot_id": None,
}


DEMO_KMEANS_REQUEST = {
    "customer": DEMO_KMEANS_CUSTOMER,
    "save_result": False,
    "customer_id": None,
    "behavior_snapshot_id": None,
}


DEMO_XGBOOST_BATCH_REQUEST = {
    "customers": [DEMO_XGBOOST_CUSTOMER, DEMO_XGBOOST_CUSTOMER],
    "save_results": False,
    "customer_ids": None,
    "behavior_snapshot_ids": None,
}


DEMO_KMEANS_BATCH_REQUEST = {
    "customers": [DEMO_KMEANS_CUSTOMER, DEMO_KMEANS_CUSTOMER],
    "save_results": False,
    "customer_ids": None,
    "behavior_snapshot_ids": None,
}
