// Generated from reports/auth03/accounts_openapi.json. Do not hand-edit. Calendar timezone extension applied by generator.
// SHA256: d9759677ca93832202f2d1cb20f86e2a2ba4994d685a634428f56c5b6995735a
export interface paths {
    "/predict/purchase-level": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Purchase Level */
        post: operations["purchase_level_predict_purchase_level_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/predict/segment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Segment */
        post: operations["segment_predict_segment_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/predict/batch/purchase-level": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Batch Purchase Level */
        post: operations["batch_purchase_level_predict_batch_purchase_level_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/predict/batch/segment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Batch Segment */
        post: operations["batch_segment_predict_batch_segment_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/predict/csv/purchase-level": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Csv Purchase Level */
        post: operations["csv_purchase_level_predict_csv_purchase_level_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/predict/csv/segment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Csv Segment */
        post: operations["csv_segment_predict_csv_segment_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Customers */
        get: operations["list_customers_customers_get"];
        put?: never;
        /** Create Customer */
        post: operations["create_customer_customers_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customers/{customer_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Customer */
        get: operations["get_customer_customers__customer_id__get"];
        put?: never;
        post?: never;
        /** Deactivate Customer */
        delete: operations["deactivate_customer_customers__customer_id__delete"];
        options?: never;
        head?: never;
        /** Update Customer */
        patch: operations["update_customer_customers__customer_id__patch"];
        trace?: never;
    };
    "/customers/{customer_id}/behaviors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Behavior Snapshots */
        get: operations["list_behavior_snapshots_customers__customer_id__behaviors_get"];
        put?: never;
        /** Add Behavior Snapshot */
        post: operations["add_behavior_snapshot_customers__customer_id__behaviors_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customers/{customer_id}/predictions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Prediction History */
        get: operations["list_prediction_history_customers__customer_id__predictions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customers/{customer_id}/segments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Segmentation History */
        get: operations["list_segmentation_history_customers__customer_id__segments_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/database/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Database Health */
        get: operations["database_health_database_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health
         * @description Process liveness, not model/DB readiness or research validity.
         */
        get: operations["health_api_v1_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Ready
         * @description Full-app readiness requires both pinned legacy defaults and PostgreSQL.
         */
        get: operations["ready_api_v1_ready_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/model-info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Catalog
         * @description API version != model version. Explicit research availability is not promotion.
         */
        get: operations["catalog_api_v1_model_info_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Overview */
        get: operations["overview_api_v1_overview_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/segments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Segments
         * @description Version-scoped definitions/counts of saved results, not unique customer counts.
         */
        get: operations["segments_api_v1_segments_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/predict/purchase-level": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Purchase
         * @description Classify the current snapshot, not a purchase in a future time window.
         */
        post: operations["purchase_api_v1_predict_purchase_level_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/predict/segment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Segment
         * @description Describe a snapshot segment. Standardized Euclidean distance is not confidence.
         */
        post: operations["segment_api_v1_predict_segment_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/predict/batch/purchase-level": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Purchase Batch */
        post: operations["purchase_batch_api_v1_predict_batch_purchase_level_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/predict/batch/segment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Segment Batch */
        post: operations["segment_batch_api_v1_predict_batch_segment_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/predict/csv/purchase-level": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Purchase Csv */
        post: operations["purchase_csv_api_v1_predict_csv_purchase_level_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/predict/csv/segment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Segment Csv */
        post: operations["segment_csv_api_v1_predict_csv_segment_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/customers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Customers */
        get: operations["list_customers_api_v1_customers_get"];
        put?: never;
        /** Create Customer */
        post: operations["create_customer_api_v1_customers_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/customers/{customer_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Customer */
        get: operations["customer_api_v1_customers__customer_id__get"];
        put?: never;
        post?: never;
        /** Deactivate Customer */
        delete: operations["deactivate_customer_api_v1_customers__customer_id__delete"];
        options?: never;
        head?: never;
        /** Update Customer */
        patch: operations["update_customer_api_v1_customers__customer_id__patch"];
        trace?: never;
    };
    "/api/v1/customers/{customer_id}/behaviors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Behaviors */
        get: operations["behaviors_api_v1_customers__customer_id__behaviors_get"];
        put?: never;
        /** Add Behavior */
        post: operations["add_behavior_api_v1_customers__customer_id__behaviors_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/customers/{customer_id}/predictions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Predictions */
        get: operations["predictions_api_v1_customers__customer_id__predictions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/customers/{customer_id}/segments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Customer Segments */
        get: operations["customer_segments_api_v1_customers__customer_id__segments_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/what-if/schema": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Schema */
        get: operations["schema_api_v1_what_if_schema_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/what-if/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview */
        post: operations["preview_api_v1_what_if_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/what-if": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Compare */
        post: operations["compare_api_v1_what_if_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/what-if/scenarios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** History */
        get: operations["history_api_v1_what_if_scenarios_get"];
        put?: never;
        /** Save */
        post: operations["save_api_v1_what_if_scenarios_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/what-if/scenarios/{scenario_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detail */
        get: operations["detail_api_v1_what_if_scenarios__scenario_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read-only aggregation with explicit units/cohort/UTC semantics
         * @description Secured viewer/operator only. Local remains explicit unauthenticated demo. Cross-field rules in docs/t12_dashboard_api_design.md. No inference/write/migration/registry/promotion or event-time/causal forecast. No request body; nonempty body400.
         */
        get: operations["dashboard_overview_v1_proposed"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Root */
        get: operations["root__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/models/info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Models Info */
        get: operations["models_info_models_info_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/csrf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** csrf */
        get: operations["auth01_csrf"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** login */
        post: operations["auth01_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** me */
        get: operations["auth01_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** logout */
        post: operations["auth01_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** change password */
        post: operations["auth01_change_password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** list users */
        get: operations["auth01_list_users"];
        put?: never;
        /** create user */
        post: operations["auth01_create_user"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** get user */
        get: operations["auth01_get_user"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** patch user */
        patch: operations["auth01_patch_user"];
        trace?: never;
    };
    "/api/v1/admin/users/{user_id}/reset-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** reset password */
        post: operations["auth01_reset_password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users/{user_id}/revoke-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** revoke sessions */
        post: operations["auth01_revoke_sessions"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** BatchPredictionRequest */
        BatchPredictionRequest: {
            /**
             * Customers
             * @description Danh sách từ 1 đến 100 khách hàng
             */
            customers: {
                [key: string]: unknown;
            }[];
            /**
             * Save Results
             * @default false
             */
            save_results: boolean;
            /** Customer Ids */
            customer_ids?: (string | null)[] | null;
            /** Behavior Snapshot Ids */
            behavior_snapshot_ids?: (string | null)[] | null;
        };
        /**
         * BehaviorCreateV1
         * @example {
         *       "Age": 43,
         *       "Average_Order_Value": 94.72,
         *       "Cart_Abandonment_Rate": 50.6,
         *       "Churned": false,
         *       "City": "Marseille",
         *       "Country": "France",
         *       "Credit_Balance": 2278,
         *       "Customer_Service_Calls": 9,
         *       "Days_Since_Last_Purchase": 34,
         *       "Discount_Usage_Rate": 46.4,
         *       "Email_Open_Rate": 17.9,
         *       "Gender": "Male",
         *       "Lifetime_Value": 953.33,
         *       "Login_Frequency": 14,
         *       "Membership_Years": 2.9,
         *       "Mobile_App_Usage": 20.8,
         *       "Pages_Per_Session": 6,
         *       "Payment_Method_Diversity": 1,
         *       "Product_Reviews_Written": 4,
         *       "Returns_Rate": 2,
         *       "Session_Duration_Avg": 27.4,
         *       "Signup_Quarter": "Q1",
         *       "Social_Media_Engagement_Score": 16.3,
         *       "Total_Purchases": 9,
         *       "Wishlist_Items": 3,
         *       "source": "video-demo"
         *     }
         */
        BehaviorCreateV1: {
            /** Captured At */
            captured_at?: string | null;
            /**
             * Source
             * @default manual
             */
            source: string;
            /** Age */
            Age: number;
            /** Gender */
            Gender: string;
            /** Country */
            Country: string;
            /** City */
            City: string;
            /** Membership Years */
            Membership_Years: number;
            /** Login Frequency */
            Login_Frequency: number;
            /** Session Duration Avg */
            Session_Duration_Avg: number;
            /** Pages Per Session */
            Pages_Per_Session: number;
            /** Cart Abandonment Rate */
            Cart_Abandonment_Rate: number;
            /** Wishlist Items */
            Wishlist_Items: number;
            /** Total Purchases */
            Total_Purchases: number;
            /** Average Order Value */
            Average_Order_Value: number;
            /** Days Since Last Purchase */
            Days_Since_Last_Purchase: number;
            /** Discount Usage Rate */
            Discount_Usage_Rate: number;
            /** Returns Rate */
            Returns_Rate: number;
            /** Email Open Rate */
            Email_Open_Rate: number;
            /** Customer Service Calls */
            Customer_Service_Calls: number;
            /** Product Reviews Written */
            Product_Reviews_Written: number;
            /** Social Media Engagement Score */
            Social_Media_Engagement_Score: number;
            /** Mobile App Usage */
            Mobile_App_Usage: number;
            /** Payment Method Diversity */
            Payment_Method_Diversity: number;
            /** Lifetime Value */
            Lifetime_Value: number;
            /** Credit Balance */
            Credit_Balance: number;
            /** Churned */
            Churned: boolean;
            /** Signup Quarter */
            Signup_Quarter: string;
        };
        /**
         * BehaviorSnapshotCreate
         * @example {
         *       "Age": 43,
         *       "Average_Order_Value": 94.72,
         *       "Cart_Abandonment_Rate": 50.6,
         *       "Churned": false,
         *       "City": "Marseille",
         *       "Country": "France",
         *       "Credit_Balance": 2278,
         *       "Customer_Service_Calls": 9,
         *       "Days_Since_Last_Purchase": 34,
         *       "Discount_Usage_Rate": 46.4,
         *       "Email_Open_Rate": 17.9,
         *       "Gender": "Male",
         *       "Lifetime_Value": 953.33,
         *       "Login_Frequency": 14,
         *       "Membership_Years": 2.9,
         *       "Mobile_App_Usage": 20.8,
         *       "Pages_Per_Session": 6,
         *       "Payment_Method_Diversity": 1,
         *       "Product_Reviews_Written": 4,
         *       "Returns_Rate": 2,
         *       "Session_Duration_Avg": 27.4,
         *       "Signup_Quarter": "Q1",
         *       "Social_Media_Engagement_Score": 16.3,
         *       "Total_Purchases": 9,
         *       "Wishlist_Items": 3,
         *       "source": "video-demo"
         *     }
         */
        BehaviorSnapshotCreate: {
            /** Captured At */
            captured_at?: string | null;
            /**
             * Source
             * @default manual
             */
            source: string;
            /** Age */
            Age: number;
            /** Gender */
            Gender: string;
            /** Country */
            Country: string;
            /** City */
            City: string;
            /** Membership Years */
            Membership_Years: number;
            /** Login Frequency */
            Login_Frequency: number;
            /** Session Duration Avg */
            Session_Duration_Avg: number;
            /** Pages Per Session */
            Pages_Per_Session: number;
            /** Cart Abandonment Rate */
            Cart_Abandonment_Rate: number;
            /** Wishlist Items */
            Wishlist_Items: number;
            /** Total Purchases */
            Total_Purchases: number;
            /** Average Order Value */
            Average_Order_Value: number;
            /** Days Since Last Purchase */
            Days_Since_Last_Purchase: number;
            /** Discount Usage Rate */
            Discount_Usage_Rate: number;
            /** Returns Rate */
            Returns_Rate: number;
            /** Email Open Rate */
            Email_Open_Rate: number;
            /** Customer Service Calls */
            Customer_Service_Calls: number;
            /** Product Reviews Written */
            Product_Reviews_Written: number;
            /** Social Media Engagement Score */
            Social_Media_Engagement_Score: number;
            /** Mobile App Usage */
            Mobile_App_Usage: number;
            /** Payment Method Diversity */
            Payment_Method_Diversity: number;
            /** Lifetime Value */
            Lifetime_Value: number;
            /** Credit Balance */
            Credit_Balance: number;
            /** Churned */
            Churned: boolean;
            /** Signup Quarter */
            Signup_Quarter: string;
        };
        /** BehaviorSnapshotPage */
        BehaviorSnapshotPage: {
            /** Items */
            items: components["schemas"]["BehaviorSnapshotRead"][];
            /** Total */
            total: number;
            /** Offset */
            offset: number;
            /** Limit */
            limit: number;
        };
        /**
         * BehaviorSnapshotRead
         * @example {
         *       "Age": 43,
         *       "Average_Order_Value": 94.72,
         *       "Cart_Abandonment_Rate": 50.6,
         *       "Churned": false,
         *       "City": "Marseille",
         *       "Country": "France",
         *       "Credit_Balance": 2278,
         *       "Customer_Service_Calls": 9,
         *       "Days_Since_Last_Purchase": 34,
         *       "Discount_Usage_Rate": 46.4,
         *       "Email_Open_Rate": 17.9,
         *       "Gender": "Male",
         *       "Lifetime_Value": 953.33,
         *       "Login_Frequency": 14,
         *       "Membership_Years": 2.9,
         *       "Mobile_App_Usage": 20.8,
         *       "Pages_Per_Session": 6,
         *       "Payment_Method_Diversity": 1,
         *       "Product_Reviews_Written": 4,
         *       "Returns_Rate": 2,
         *       "Session_Duration_Avg": 27.4,
         *       "Signup_Quarter": "Q1",
         *       "Social_Media_Engagement_Score": 16.3,
         *       "Total_Purchases": 9,
         *       "Wishlist_Items": 3,
         *       "source": "video-demo"
         *     }
         */
        BehaviorSnapshotRead: {
            /**
             * Captured At
             * Format: date-time
             */
            captured_at: string;
            /**
             * Source
             * @default manual
             */
            source: string;
            /** Age */
            Age: number;
            /** Gender */
            Gender: string;
            /** Country */
            Country: string;
            /** City */
            City: string;
            /** Membership Years */
            Membership_Years: number;
            /** Login Frequency */
            Login_Frequency: number;
            /** Session Duration Avg */
            Session_Duration_Avg: number;
            /** Pages Per Session */
            Pages_Per_Session: number;
            /** Cart Abandonment Rate */
            Cart_Abandonment_Rate: number;
            /** Wishlist Items */
            Wishlist_Items: number;
            /** Total Purchases */
            Total_Purchases: number;
            /** Average Order Value */
            Average_Order_Value: number;
            /** Days Since Last Purchase */
            Days_Since_Last_Purchase: number;
            /** Discount Usage Rate */
            Discount_Usage_Rate: number;
            /** Returns Rate */
            Returns_Rate: number;
            /** Email Open Rate */
            Email_Open_Rate: number;
            /** Customer Service Calls */
            Customer_Service_Calls: number;
            /** Product Reviews Written */
            Product_Reviews_Written: number;
            /** Social Media Engagement Score */
            Social_Media_Engagement_Score: number;
            /** Mobile App Usage */
            Mobile_App_Usage: number;
            /** Payment Method Diversity */
            Payment_Method_Diversity: number;
            /** Lifetime Value */
            Lifetime_Value: number;
            /** Credit Balance */
            Credit_Balance: number;
            /** Churned */
            Churned: boolean;
            /** Signup Quarter */
            Signup_Quarter: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Customer Id
             * Format: uuid
             */
            customer_id: string;
        };
        /** Body_csv_purchase_level_predict_csv_purchase_level_post */
        Body_csv_purchase_level_predict_csv_purchase_level_post: {
            /** File */
            file: string;
            /**
             * Save Results
             * @default false
             */
            save_results: boolean;
        };
        /** Body_csv_segment_predict_csv_segment_post */
        Body_csv_segment_predict_csv_segment_post: {
            /** File */
            file: string;
            /**
             * Save Results
             * @default false
             */
            save_results: boolean;
        };
        /** Body_purchase_csv_api_v1_predict_csv_purchase_level_post */
        Body_purchase_csv_api_v1_predict_csv_purchase_level_post: {
            /** File */
            file: string;
            /**
             * Model Version
             * @default 1.0.0
             */
            model_version: string;
            /**
             * Save Results
             * @default false
             */
            save_results: boolean;
        };
        /** Body_segment_csv_api_v1_predict_csv_segment_post */
        Body_segment_csv_api_v1_predict_csv_segment_post: {
            /** File */
            file: string;
            /**
             * Model Version
             * @default 1.0.0
             */
            model_version: string;
            /**
             * Save Results
             * @default false
             */
            save_results: boolean;
        };
        /** CatalogResponse */
        CatalogResponse: {
            /**
             * Contract Version
             * @default 1.0.0
             * @constant
             */
            contract_version: "1.0.0";
            /** Models */
            models: components["schemas"]["ModelInfo"][];
        };
        /**
         * CustomerCreate
         * @example {
         *       "external_id": "VIDEO-DEMO-001"
         *     }
         */
        CustomerCreate: {
            /** External Id */
            external_id: string;
        };
        /** CustomerPage */
        CustomerPage: {
            /** Items */
            items: components["schemas"]["CustomerRead"][];
            /** Total */
            total: number;
            /** Offset */
            offset: number;
            /** Limit */
            limit: number;
        };
        /** CustomerRead */
        CustomerRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** External Id */
            external_id: string;
            /** Is Active */
            is_active: boolean;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Deactivated At */
            deactivated_at: string | null;
        };
        /**
         * CustomerUpdate
         * @example {
         *       "external_id": "VIDEO-DEMO-001-UPDATED",
         *       "is_active": true
         *     }
         */
        CustomerUpdate: {
            /** External Id */
            external_id?: string | null;
            /** Is Active */
            is_active?: boolean | null;
        };
        /**
         * CustomerUpdateV1
         * @example {
         *       "external_id": "VIDEO-DEMO-001-UPDATED",
         *       "is_active": true
         *     }
         */
        CustomerUpdateV1: {
            /** External Id */
            external_id?: string | null;
            /** Is Active */
            is_active?: boolean | null;
        };
        /** ErrorBody */
        ErrorBody: {
            /** Code */
            code: string;
            /** Message */
            message: string;
            /**
             * Details
             * @default []
             */
            details: components["schemas"]["ErrorDetail"][];
            /**
             * Request Id
             * Format: uuid
             */
            request_id: string;
        };
        /** ErrorDetail */
        ErrorDetail: {
            /**
             * Location
             * @default []
             */
            location: (string | number)[];
            /** Code */
            code: string;
            /** Message */
            message: string;
        };
        /** ErrorEnvelope */
        ErrorEnvelope: {
            error: components["schemas"]["ErrorBody"];
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** HealthResponse */
        HealthResponse: {
            /**
             * Status
             * @default alive
             * @constant
             */
            status: "alive";
            /**
             * Contract Version
             * @default 1.0.0
             * @constant
             */
            contract_version: "1.0.0";
        };
        /** HistoryPage */
        HistoryPage: {
            /** Items */
            items: (components["schemas"]["PredictionHistoryRead"] | components["schemas"]["SegmentationHistoryRead"])[];
            /** Total */
            total: number;
            /** Offset */
            offset: number;
            /** Limit */
            limit: number;
        };
        /** LegacyPurchaseBatch */
        LegacyPurchaseBatch: {
            /**
             * Save Results
             * @default false
             */
            save_results: boolean;
            /** Customer Ids */
            customer_ids?: (string | null)[] | null;
            /** Behavior Snapshot Ids */
            behavior_snapshot_ids?: (string | null)[] | null;
            /**
             * Model Version
             * @default 1.0.0
             * @constant
             */
            model_version: "1.0.0";
            /** Customers */
            customers: components["schemas"]["LegacyPurchaseCustomer"][];
        };
        /** LegacyPurchaseCustomer */
        LegacyPurchaseCustomer: {
            /** Age */
            Age: number;
            /** Gender */
            Gender: string;
            /** Country */
            Country: string;
            /** City */
            City: string;
            /** Membership Years */
            Membership_Years: number;
            /** Login Frequency */
            Login_Frequency: number;
            /** Session Duration Avg */
            Session_Duration_Avg: number;
            /** Pages Per Session */
            Pages_Per_Session: number;
            /** Cart Abandonment Rate */
            Cart_Abandonment_Rate: number;
            /** Wishlist Items */
            Wishlist_Items: number;
            /** Average Order Value */
            Average_Order_Value: number;
            /** Days Since Last Purchase */
            Days_Since_Last_Purchase: number;
            /** Discount Usage Rate */
            Discount_Usage_Rate: number;
            /** Returns Rate */
            Returns_Rate: number;
            /** Email Open Rate */
            Email_Open_Rate: number;
            /** Customer Service Calls */
            Customer_Service_Calls: number;
            /** Product Reviews Written */
            Product_Reviews_Written: number;
            /** Social Media Engagement Score */
            Social_Media_Engagement_Score: number;
            /** Mobile App Usage */
            Mobile_App_Usage: number;
            /** Payment Method Diversity */
            Payment_Method_Diversity: number;
            /** Lifetime Value */
            Lifetime_Value: number;
            /** Credit Balance */
            Credit_Balance: number;
            /** Churned */
            Churned: number;
            /**
             * Signup Quarter
             * @enum {string}
             */
            Signup_Quarter: "Q1" | "Q2" | "Q3" | "Q4";
        };
        /** LegacyPurchaseRequest */
        LegacyPurchaseRequest: {
            /**
             * Save Result
             * @default false
             */
            save_result: boolean;
            /** Customer Id */
            customer_id?: string | null;
            /** Behavior Snapshot Id */
            behavior_snapshot_id?: string | null;
            /**
             * Model Version
             * @default 1.0.0
             * @constant
             */
            model_version: "1.0.0";
            customer: components["schemas"]["LegacyPurchaseCustomer"];
        };
        /** LegacySegmentBatch */
        LegacySegmentBatch: {
            /**
             * Save Results
             * @default false
             */
            save_results: boolean;
            /** Customer Ids */
            customer_ids?: (string | null)[] | null;
            /** Behavior Snapshot Ids */
            behavior_snapshot_ids?: (string | null)[] | null;
            /**
             * Model Version
             * @default 1.0.0
             * @constant
             */
            model_version: "1.0.0";
            /** Customers */
            customers: components["schemas"]["LegacySegmentCustomer"][];
        };
        /** LegacySegmentCustomer */
        LegacySegmentCustomer: {
            /** Login Frequency */
            Login_Frequency: number;
            /** Session Duration Avg */
            Session_Duration_Avg: number;
            /** Pages Per Session */
            Pages_Per_Session: number;
            /** Cart Abandonment Rate */
            Cart_Abandonment_Rate: number;
            /** Wishlist Items */
            Wishlist_Items: number;
            /** Total Purchases */
            Total_Purchases: number;
            /** Average Order Value */
            Average_Order_Value: number;
            /** Days Since Last Purchase */
            Days_Since_Last_Purchase: number;
            /** Discount Usage Rate */
            Discount_Usage_Rate: number;
            /** Mobile App Usage */
            Mobile_App_Usage: number;
        };
        /** LegacySegmentRequest */
        LegacySegmentRequest: {
            /**
             * Save Result
             * @default false
             */
            save_result: boolean;
            /** Customer Id */
            customer_id?: string | null;
            /** Behavior Snapshot Id */
            behavior_snapshot_id?: string | null;
            /**
             * Model Version
             * @default 1.0.0
             * @constant
             */
            model_version: "1.0.0";
            customer: components["schemas"]["LegacySegmentCustomer"];
        };
        /** ModelInfo */
        ModelInfo: {
            /**
             * Task
             * @enum {string}
             */
            task: "classification" | "segmentation";
            /** Model Id */
            model_id: string;
            /** Model Version */
            model_version: string;
            /** Is Default */
            is_default: boolean;
            /**
             * Serving Mode
             * @enum {string}
             */
            serving_mode: "legacy_default" | "explicit_research";
            /** Available */
            available: boolean;
            /** Unavailable Code */
            unavailable_code?: string | null;
            /** Persistence Supported */
            persistence_supported: boolean;
            /** Artifact Sha256 */
            artifact_sha256: string;
            /** Feature Count */
            feature_count: number;
            /** Features */
            features: string[];
            /** Input Schema */
            input_schema: {
                [key: string]: unknown;
            };
            /** Label Namespace */
            label_namespace: string;
            /** Labels */
            labels: {
                [key: string]: string;
            };
            /** Limitations */
            limitations: string[];
        };
        /** OverviewResponse */
        OverviewResponse: {
            /**
             * Generated At
             * Format: date-time
             */
            generated_at: string;
            /** Counts */
            counts: {
                [key: string]: number;
            };
            /**
             * Source
             * @default application_postgresql_not_research_dataset
             * @constant
             */
            source: "application_postgresql_not_research_dataset";
        };
        /** PredictionHistoryPageV1 */
        PredictionHistoryPageV1: {
            /** Items */
            items: components["schemas"]["PredictionHistoryV1"][];
            /** Total */
            total: number;
            /** Offset */
            offset: number;
            /** Limit */
            limit: number;
        };
        /** PredictionHistoryRead */
        PredictionHistoryRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Run Id
             * Format: uuid
             */
            run_id: string;
            /**
             * Model Id
             * Format: uuid
             */
            model_id: string;
            /** Customer Id */
            customer_id: string | null;
            /** Behavior Snapshot Id */
            behavior_snapshot_id: string | null;
            /** Predicted Class */
            predicted_class: number;
            /** Purchase Level */
            purchase_level: string;
            /** Probability Low */
            probability_low: number;
            /** Probability Medium */
            probability_medium: number;
            /** Probability High */
            probability_high: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** PredictionHistoryV1 */
        PredictionHistoryV1: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Run Id
             * Format: uuid
             */
            run_id: string;
            /** Model Id */
            model_id: string;
            /** Customer Id */
            customer_id: string | null;
            /** Behavior Snapshot Id */
            behavior_snapshot_id: string | null;
            /**
             * Predicted Class
             * @enum {integer}
             */
            predicted_class: 0 | 1 | 2;
            /**
             * Purchase Level
             * @enum {string}
             */
            purchase_level: "Low" | "Medium" | "High";
            /** Probability Low */
            probability_low: number;
            /** Probability Medium */
            probability_medium: number;
            /** Probability High */
            probability_high: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Model Registry Id
             * Format: uuid
             */
            model_registry_id: string;
            /** Model Name */
            model_name: string;
            /** Model Version */
            model_version: string;
        };
        /** PredictionRequest */
        PredictionRequest: {
            /**
             * Customer
             * @description Thông tin đặc trưng của một khách hàng
             */
            customer: {
                [key: string]: unknown;
            };
            /**
             * Save Result
             * @default false
             */
            save_result: boolean;
            /** Customer Id */
            customer_id?: string | null;
            /** Behavior Snapshot Id */
            behavior_snapshot_id?: string | null;
        };
        /** Probabilities */
        Probabilities: {
            /** Low */
            Low: number;
            /** Medium */
            Medium: number;
            /** High */
            High: number;
        };
        /** PurchaseBatchResponse */
        PurchaseBatchResponse: {
            /** Total */
            total: number;
            /** Results */
            results: components["schemas"]["PurchaseResponse"][];
        };
        /** PurchaseResponse */
        PurchaseResponse: {
            /**
             * Task
             * @default classification
             * @constant
             */
            task: "classification";
            /**
             * Model Id
             * @default purchase-level-xgboost
             * @constant
             */
            model_id: "purchase-level-xgboost";
            /** Model Version */
            model_version: string;
            /**
             * Generated At
             * Format: date-time
             */
            generated_at: string;
            /**
             * Predicted Class
             * @enum {integer}
             */
            predicted_class: 0 | 1 | 2;
            /**
             * Purchase Level
             * @enum {string}
             */
            purchase_level: "Low" | "Medium" | "High";
            probabilities: components["schemas"]["Probabilities"];
            /** Target Thresholds */
            target_thresholds: {
                [key: string]: number;
            };
            /**
             * Decision Rule
             * @default argmax_probability
             * @constant
             */
            decision_rule: "argmax_probability";
            /**
             * Scope
             * @default snapshot_classification_not_future_forecast
             * @constant
             */
            scope: "snapshot_classification_not_future_forecast";
        };
        /** ReadyResponse */
        ReadyResponse: {
            /**
             * Status
             * @default ready
             * @constant
             */
            status: "ready";
            /** Default Models Available */
            default_models_available: boolean;
            /** Database Available */
            database_available: boolean;
        };
        /** SegmentBatchResponse */
        SegmentBatchResponse: {
            /** Total */
            total: number;
            /** Results */
            results: components["schemas"]["SegmentResponse"][];
        };
        /** SegmentHistoryPageV1 */
        SegmentHistoryPageV1: {
            /** Items */
            items: components["schemas"]["SegmentHistoryV1"][];
            /** Total */
            total: number;
            /** Offset */
            offset: number;
            /** Limit */
            limit: number;
        };
        /** SegmentHistoryV1 */
        SegmentHistoryV1: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Run Id
             * Format: uuid
             */
            run_id: string;
            /** Model Id */
            model_id: string;
            /** Customer Id */
            customer_id: string | null;
            /** Behavior Snapshot Id */
            behavior_snapshot_id: string | null;
            /** Cluster */
            cluster: number;
            /** Segment Name */
            segment_name: string;
            /** Distance To Centroid */
            distance_to_centroid: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Model Registry Id
             * Format: uuid
             */
            model_registry_id: string;
            /** Model Name */
            model_name: string;
            /** Model Version */
            model_version: string;
            /** Segment Id */
            segment_id: string;
        };
        /** SegmentResponse */
        SegmentResponse: {
            /**
             * Task
             * @default segmentation
             * @constant
             */
            task: "segmentation";
            /**
             * Model Id
             * @default customer-segmentation-kmeans
             * @constant
             */
            model_id: "customer-segmentation-kmeans";
            /** Model Version */
            model_version: string;
            /**
             * Generated At
             * Format: date-time
             */
            generated_at: string;
            /** Cluster */
            cluster: number;
            /** Segment Id */
            segment_id: string;
            /** Segment Name */
            segment_name: string;
            /** Distance To Centroid */
            distance_to_centroid: number;
            /**
             * Distance Kind
             * @default standardized_euclidean_not_probability
             * @constant
             */
            distance_kind: "standardized_euclidean_not_probability";
            /** Input Quality */
            input_quality?: {
                [key: string]: unknown;
            } | null;
            /**
             * Scope
             * @default descriptive_snapshot_not_causal_or_future
             * @constant
             */
            scope: "descriptive_snapshot_not_causal_or_future";
        };
        /** SegmentationHistoryRead */
        SegmentationHistoryRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Run Id
             * Format: uuid
             */
            run_id: string;
            /**
             * Model Id
             * Format: uuid
             */
            model_id: string;
            /** Customer Id */
            customer_id: string | null;
            /** Behavior Snapshot Id */
            behavior_snapshot_id: string | null;
            /** Cluster */
            cluster: number;
            /** Segment Name */
            segment_name: string;
            /** Distance To Centroid */
            distance_to_centroid: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** SegmentsResponse */
        SegmentsResponse: {
            /** Model Version */
            model_version: string;
            /** Definitions */
            definitions: {
                [key: string]: {
                    [key: string]: string;
                };
            };
            /** Stored Result Counts */
            stored_result_counts: {
                [key: string]: number;
            };
            /**
             * Count Unit
             * @default stored_segmentation_results_not_unique_customers
             * @constant
             */
            count_unit: "stored_segmentation_results_not_unique_customers";
            /**
             * Scope
             * @default descriptive_snapshot
             * @constant
             */
            scope: "descriptive_snapshot";
        };
        /** T4PurchaseBatch */
        T4PurchaseBatch: {
            /**
             * Save Results
             * @default false
             */
            save_results: boolean;
            /** Customer Ids */
            customer_ids?: (string | null)[] | null;
            /** Behavior Snapshot Ids */
            behavior_snapshot_ids?: (string | null)[] | null;
            /**
             * Model Version
             * @constant
             */
            model_version: "2.0.0-snapshot-conservative12";
            /** Customers */
            customers: components["schemas"]["T4PurchaseCustomer"][];
        };
        /** T4PurchaseCustomer */
        T4PurchaseCustomer: {
            /** Age */
            Age: number | null;
            /** Gender */
            Gender: string | null;
            /** Country */
            Country: string | null;
            /** City */
            City: string | null;
            /** Membership Years */
            Membership_Years: number | null;
            /** Login Frequency */
            Login_Frequency: number | null;
            /** Session Duration Avg */
            Session_Duration_Avg: number | null;
            /** Pages Per Session */
            Pages_Per_Session: number | null;
            /** Wishlist Items */
            Wishlist_Items: number | null;
            /** Email Open Rate */
            Email_Open_Rate: number | null;
            /** Mobile App Usage */
            Mobile_App_Usage: number | null;
            /** Signup Quarter */
            Signup_Quarter: ("Q1" | "Q2" | "Q3" | "Q4") | null;
        };
        /** T4PurchaseRequest */
        T4PurchaseRequest: {
            /**
             * Save Result
             * @default false
             */
            save_result: boolean;
            /** Customer Id */
            customer_id?: string | null;
            /** Behavior Snapshot Id */
            behavior_snapshot_id?: string | null;
            /**
             * Model Version
             * @constant
             */
            model_version: "2.0.0-snapshot-conservative12";
            customer: components["schemas"]["T4PurchaseCustomer"];
        };
        /** T5SegmentBatch */
        T5SegmentBatch: {
            /**
             * Save Results
             * @default false
             */
            save_results: boolean;
            /** Customer Ids */
            customer_ids?: (string | null)[] | null;
            /** Behavior Snapshot Ids */
            behavior_snapshot_ids?: (string | null)[] | null;
            /**
             * Model Version
             * @constant
             */
            model_version: "2.0.0-snapshot-k3";
            /** Customers */
            customers: components["schemas"]["T5SegmentCustomer"][];
        };
        /** T5SegmentCustomer */
        T5SegmentCustomer: {
            /** Login Frequency */
            Login_Frequency: number | null;
            /** Session Duration Avg */
            Session_Duration_Avg: number | null;
            /** Pages Per Session */
            Pages_Per_Session: number | null;
            /** Cart Abandonment Rate */
            Cart_Abandonment_Rate: number | null;
            /** Wishlist Items */
            Wishlist_Items: number | null;
            /** Total Purchases */
            Total_Purchases: number | null;
            /** Average Order Value */
            Average_Order_Value: number | null;
            /** Days Since Last Purchase */
            Days_Since_Last_Purchase: number | null;
            /** Discount Usage Rate */
            Discount_Usage_Rate: number | null;
            /** Mobile App Usage */
            Mobile_App_Usage: number | null;
        };
        /** T5SegmentRequest */
        T5SegmentRequest: {
            /**
             * Save Result
             * @default false
             */
            save_result: boolean;
            /** Customer Id */
            customer_id?: string | null;
            /** Behavior Snapshot Id */
            behavior_snapshot_id?: string | null;
            /**
             * Model Version
             * @constant
             */
            model_version: "2.0.0-snapshot-k3";
            customer: components["schemas"]["T5SegmentCustomer"];
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input?: unknown;
            /** Context */
            ctx?: Record<string, never>;
        };
        /** WhatIfClassDeltas */
        WhatIfClassDeltas: {
            /** Absolute */
            absolute: {
                [key: string]: number;
            };
            /** Percentage Points */
            percentage_points: {
                [key: string]: number;
            };
            /** Relative */
            relative: {
                [key: string]: number | null;
            };
        };
        /** WhatIfClassificationOutcome */
        WhatIfClassificationOutcome: {
            /**
             * Task
             * @constant
             */
            task: "classification";
            model: components["schemas"]["WhatIfModelIdentity"];
            /**
             * Predicted Class
             * @enum {integer}
             */
            predicted_class: 0 | 1 | 2;
            /**
             * Purchase Level
             * @enum {string}
             */
            purchase_level: "Low" | "Medium" | "High";
            probabilities: components["schemas"]["WhatIfProbabilities"];
            /**
             * Decision Rule
             * @constant
             */
            decision_rule: "argmax_probability";
            /** Target Thresholds */
            target_thresholds: {
                [key: string]: number;
            };
        };
        /** WhatIfCompareRequest */
        WhatIfCompareRequest: {
            /**
             * Contract Version
             * @constant
             */
            contract_version: "what-if-snapshot-v1";
            models: components["schemas"]["WhatIfModelSelection"];
            /** Baseline */
            baseline: components["schemas"]["WhatIfFeaturesBaseline"] | components["schemas"]["WhatIfCustomerBaseline"];
            /** Changes */
            changes: {
                [key: string]: number;
            };
            /** Expected Baseline Fingerprint */
            expected_baseline_fingerprint?: string | null;
        };
        /** WhatIfComparisonResponse */
        WhatIfComparisonResponse: {
            /**
             * Contract Version
             * @constant
             */
            contract_version: "what-if-snapshot-v1";
            baseline: components["schemas"]["WhatIfPreviewResponse"];
            /** Scenario Input */
            scenario_input: {
                [key: string]: number | string | null;
            };
            scenario_classification: components["schemas"]["WhatIfClassificationOutcome"];
            scenario_segmentation: components["schemas"]["WhatIfSegmentationOutcome"] | null;
            /** Changed Fields */
            changed_fields: components["schemas"]["WhatIfFeatureChange"][];
            /** Classification Label Changed */
            classification_label_changed: boolean;
            probability_deltas: components["schemas"]["WhatIfClassDeltas"];
            /** Comparison Fingerprint */
            comparison_fingerprint: string;
            /** Warnings */
            warnings: string[];
            /**
             * Disclaimer
             * @constant
             */
            disclaimer: "Mô phỏng phản ứng của mô hình với input giả định; không phải tác động nhân quả hay dự báo giao dịch tương lai.";
            /**
             * Persisted
             * @constant
             */
            persisted: false;
        };
        /** WhatIfCustomerBaseline */
        WhatIfCustomerBaseline: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "customer";
            /**
             * Customer Id
             * Format: uuid
             */
            customer_id: string;
            /** Snapshot Id */
            snapshot_id?: string | null;
        };
        /** WhatIfFeatureChange */
        WhatIfFeatureChange: {
            /**
             * Feature
             * @enum {string}
             */
            feature: "Login_Frequency" | "Session_Duration_Avg" | "Pages_Per_Session" | "Wishlist_Items" | "Email_Open_Rate" | "Mobile_App_Usage";
            /** Before */
            before: number | null;
            /** After */
            after: number;
        };
        /** WhatIfFeatureDescriptor */
        WhatIfFeatureDescriptor: {
            /** Name */
            name: string;
            /** Type */
            type: string;
            /** Minimum */
            minimum: number | null;
            /** Maximum */
            maximum: number | null;
            /** Categories */
            categories: string[];
            /** Mutable */
            mutable: boolean;
            /** Unit */
            unit: string;
            /** Nullable Model */
            nullable_model: boolean;
        };
        /** WhatIfFeaturesBaseline */
        WhatIfFeaturesBaseline: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "features";
            /** Features */
            features: {
                [key: string]: number | string | null;
            };
        };
        /** WhatIfHistoryPage */
        WhatIfHistoryPage: {
            /** Items */
            items: components["schemas"]["WhatIfHistorySummary"][];
            /** Total */
            total: number;
            /** Offset */
            offset: number;
            /** Limit */
            limit: number;
            /**
             * Disclaimer
             * @constant
             */
            disclaimer: "Mô phỏng phản ứng của mô hình với input giả định; không phải tác động nhân quả hay dự báo giao dịch tương lai.";
        };
        /** WhatIfHistorySummary */
        WhatIfHistorySummary: {
            /**
             * Scenario Id
             * Format: uuid
             */
            scenario_id: string;
            /** Name */
            name: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Customer Id */
            customer_id: string | null;
            models: components["schemas"]["WhatIfModelSelection"] | null;
            /** Baseline Label */
            baseline_label: ("Low" | "Medium" | "High") | null;
            /** Scenario Label */
            scenario_label: ("Low" | "Medium" | "High") | null;
            /** Classification Label Changed */
            classification_label_changed: boolean | null;
            /**
             * Scope
             * @constant
             */
            scope: "snapshot_input_sensitivity_not_causal_or_future";
            /**
             * Integrity Status
             * @enum {string}
             */
            integrity_status: "verified" | "unverified";
        };
        /** WhatIfModelDescriptor */
        WhatIfModelDescriptor: {
            /** Task */
            task: string;
            /** Model Id */
            model_id: string;
            /** Model Version */
            model_version: string;
            /** Artifact Sha256 */
            artifact_sha256: string;
            /** Metadata Sha256 */
            metadata_sha256: string;
            /** Available */
            available: boolean;
            /** Feature Count */
            feature_count: number;
            /** Features */
            features: components["schemas"]["WhatIfFeatureDescriptor"][];
            /** Input Schema */
            input_schema: {
                [key: string]: unknown;
            };
            /** Persistence Supported */
            persistence_supported: boolean;
            /** Label Namespace */
            label_namespace: string;
            /** Labels */
            labels: {
                [key: string]: string;
            };
            /** Supports Probabilities */
            supports_probabilities: boolean;
            /** Distance Kind */
            distance_kind: string | null;
        };
        /** WhatIfModelIdentity */
        WhatIfModelIdentity: {
            /**
             * Model Id
             * @enum {string}
             */
            model_id: "purchase-level-xgboost" | "customer-segmentation-kmeans";
            /** Model Version */
            model_version: string;
            /** Artifact Sha256 */
            artifact_sha256: string;
            /** Metadata Sha256 */
            metadata_sha256: string;
            /**
             * Validation Policy
             * @constant
             */
            validation_policy: "what-if-snapshot-v1";
        };
        /** WhatIfModelSelection */
        WhatIfModelSelection: {
            /**
             * Classification
             * @enum {string}
             */
            classification: "1.0.0" | "2.0.0-snapshot-conservative12";
            /** Segmentation */
            segmentation?: ("1.0.0" | "2.0.0-snapshot-k3") | null;
        };
        /** WhatIfPreviewRequest */
        WhatIfPreviewRequest: {
            /**
             * Contract Version
             * @constant
             */
            contract_version: "what-if-snapshot-v1";
            models: components["schemas"]["WhatIfModelSelection"];
            /** Baseline */
            baseline: components["schemas"]["WhatIfFeaturesBaseline"] | components["schemas"]["WhatIfCustomerBaseline"];
        };
        /** WhatIfPreviewResponse */
        WhatIfPreviewResponse: {
            /**
             * Contract Version
             * @constant
             */
            contract_version: "what-if-snapshot-v1";
            /** Baseline Input */
            baseline_input: {
                [key: string]: number | string | null;
            };
            /** Baseline Fingerprint */
            baseline_fingerprint: string;
            classification: components["schemas"]["WhatIfClassificationOutcome"];
            segmentation: components["schemas"]["WhatIfSegmentationOutcome"] | null;
            /** Resolved Customer Id */
            resolved_customer_id: string | null;
            /** Resolved Snapshot Id */
            resolved_snapshot_id: string | null;
            /**
             * Generated At
             * Format: date-time
             */
            generated_at: string;
            /** Warnings */
            warnings: string[];
            /**
             * Scope
             * @constant
             */
            scope: "snapshot_input_sensitivity_not_causal_or_future";
            /**
             * Disclaimer
             * @constant
             */
            disclaimer: "Mô phỏng phản ứng của mô hình với input giả định; không phải tác động nhân quả hay dự báo giao dịch tương lai.";
            /**
             * Persisted
             * @constant
             */
            persisted: false;
        };
        /** WhatIfProbabilities */
        WhatIfProbabilities: {
            /** Low */
            Low: number;
            /** Medium */
            Medium: number;
            /** High */
            High: number;
        };
        /** WhatIfSaveRequest */
        WhatIfSaveRequest: {
            /**
             * Contract Version
             * @constant
             */
            contract_version: "what-if-snapshot-v1";
            models: components["schemas"]["WhatIfModelSelection"];
            /** Baseline */
            baseline: components["schemas"]["WhatIfFeaturesBaseline"] | components["schemas"]["WhatIfCustomerBaseline"];
            /** Changes */
            changes: {
                [key: string]: number;
            };
            /** Expected Baseline Fingerprint */
            expected_baseline_fingerprint?: string | null;
            /** Name */
            name: string;
            /** Description */
            description?: string | null;
            /** Expected Comparison Fingerprint */
            expected_comparison_fingerprint: string;
            /**
             * Acknowledge Sensitive Snapshot Storage
             * @constant
             */
            acknowledge_sensitive_snapshot_storage: true;
        };
        /** WhatIfSavedScenarioDetail */
        WhatIfSavedScenarioDetail: {
            /**
             * Contract Version
             * @constant
             */
            contract_version: "what-if-snapshot-v1";
            /**
             * Scenario Id
             * Format: uuid
             */
            scenario_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Persisted
             * @constant
             */
            persisted: true;
            /** Idempotency Replayed */
            idempotency_replayed: boolean;
            /** Original Customer Id */
            original_customer_id: string | null;
            /** Original Snapshot Id */
            original_snapshot_id: string | null;
            /** Current Customer Id */
            current_customer_id: string | null;
            /** Current Snapshot Id */
            current_snapshot_id: string | null;
            /**
             * Source Link Status
             * @enum {string}
             */
            source_link_status: "attached" | "detached" | "features_only";
            /** Name */
            name: string;
            /** Description */
            description: string | null;
            comparison: components["schemas"]["WhatIfComparisonResponse"];
            /** Results */
            results: components["schemas"]["WhatIfStoredResultReference"][];
            /**
             * Disclaimer
             * @constant
             */
            disclaimer: "Mô phỏng phản ứng của mô hình với input giả định; không phải tác động nhân quả hay dự báo giao dịch tương lai.";
            /**
             * Integrity Status
             * @constant
             */
            integrity_status: "verified";
        };
        /** WhatIfSchemaResponse */
        WhatIfSchemaResponse: {
            /**
             * Contract Version
             * @constant
             */
            contract_version: "what-if-snapshot-v1";
            /** Models */
            models: components["schemas"]["WhatIfModelDescriptor"][];
            /** Mutable Features */
            mutable_features: string[];
            /** Limits */
            limits: {
                [key: string]: number;
            };
            /**
             * Scope
             * @constant
             */
            scope: "snapshot_input_sensitivity_not_causal_or_future";
            /**
             * Disclaimer
             * @constant
             */
            disclaimer: "Mô phỏng phản ứng của mô hình với input giả định; không phải tác động nhân quả hay dự báo giao dịch tương lai.";
            /** Limitations */
            limitations: string[];
        };
        /** WhatIfSegmentationOutcome */
        WhatIfSegmentationOutcome: {
            /**
             * Task
             * @constant
             */
            task: "segmentation";
            model: components["schemas"]["WhatIfModelIdentity"];
            /** Cluster */
            cluster: number;
            /** Segment Id */
            segment_id: string;
            /** Segment Name */
            segment_name: string;
            /** Distance To Centroid */
            distance_to_centroid: number;
            /**
             * Distance Kind
             * @constant
             */
            distance_kind: "standardized_euclidean_not_probability";
        };
        /** WhatIfStoredResultReference */
        WhatIfStoredResultReference: {
            /**
             * Scenario Result Id
             * Format: uuid
             */
            scenario_result_id: string;
            /**
             * Task
             * @enum {string}
             */
            task: "classification" | "segmentation";
            /**
             * Model Registry Id
             * Format: uuid
             */
            model_registry_id: string;
            model_identity: components["schemas"]["WhatIfModelIdentity"];
        };
        /** @description Rows, not customers; total=linked+unlinked. excluded_unlinked is outside total. */
        DashboardRecordCounts: {
            total: number;
            linked: number;
            unlinked: number;
            excluded_unlinked: number;
        };
        /** @description Linked latest-result customers and missing-result customers; sum equals cohort.customers. */
        DashboardCoverage: {
            with_result: number;
            without_result: number;
        };
        DashboardClassificationModel: {
            /** @constant */
            task: "classification";
            /** @constant */
            model_id: "purchase-level-xgboost";
            /** @enum {string} */
            model_version: "1.0.0" | "2.0.0-snapshot-conservative12";
            /** @description Expected pinned checksum, not a newly executed prediction. */
            artifact_sha256: string;
            available_for_inference: boolean;
            persistence_supported: boolean;
        };
        DashboardSegmentationModel: {
            /** @constant */
            task: "segmentation";
            /** @constant */
            model_id: "customer-segmentation-kmeans";
            /** @enum {string} */
            model_version: "1.0.0" | "2.0.0-snapshot-k3";
            /** @description Expected pinned checksum, not a newly executed prediction. */
            artifact_sha256: string;
            available_for_inference: boolean;
            persistence_supported: boolean;
        };
        /** @description Mean of latest linked per-customer predictions only; not transaction confidence. */
        DashboardProbabilities: {
            Low: number;
            Medium: number;
            High: number;
        };
        DashboardPurchaseDistribution: [
            {
                /** @constant */
                purchase_level: "Low";
                customers: number;
                share: number | null;
            },
            {
                /** @constant */
                purchase_level: "Medium";
                customers: number;
                share: number | null;
            },
            {
                /** @constant */
                purchase_level: "High";
                customers: number;
                share: number | null;
            }
        ];
        DashboardSegmentDistribution: [
            {
                /** @constant */
                cluster: 0;
                /** @enum {string} */
                segment_id: "legacy:1.0.0:cluster:0" | "legacy:1.0.0:cluster:1" | "legacy:1.0.0:cluster:2" | "engagement_low" | "engagement_medium" | "engagement_high";
                display_label: string | null;
                customers: number;
                share: number | null;
            },
            {
                /** @constant */
                cluster: 1;
                /** @enum {string} */
                segment_id: "legacy:1.0.0:cluster:0" | "legacy:1.0.0:cluster:1" | "legacy:1.0.0:cluster:2" | "engagement_low" | "engagement_medium" | "engagement_high";
                display_label: string | null;
                customers: number;
                share: number | null;
            },
            {
                /** @constant */
                cluster: 2;
                /** @enum {string} */
                segment_id: "legacy:1.0.0:cluster:0" | "legacy:1.0.0:cluster:1" | "legacy:1.0.0:cluster:2" | "engagement_low" | "engagement_medium" | "engagement_high";
                display_label: string | null;
                customers: number;
                share: number | null;
            }
        ];
        DashboardClassification: {
            model: components["schemas"]["DashboardClassificationModel"];
            stored_results: components["schemas"]["DashboardRecordCounts"];
            customers: components["schemas"]["DashboardCoverage"];
            distribution: components["schemas"]["DashboardPurchaseDistribution"];
            mean_probabilities: components["schemas"]["DashboardProbabilities"] | null;
            latest_result_at: string | null;
        };
        DashboardSegmentation: {
            model: components["schemas"]["DashboardSegmentationModel"];
            stored_results: components["schemas"]["DashboardRecordCounts"];
            customers: components["schemas"]["DashboardCoverage"];
            distribution: components["schemas"]["DashboardSegmentDistribution"];
            latest_result_at: string | null;
        };
        DashboardDay: {
            /** Format: date */
            date: string;
            purchase_results: number;
            segmentation_results: number;
            what_if_scenarios: number;
            is_partial: boolean;
        };
        DashboardCustomerPreview: {
            /** Format: uuid */
            id: string;
            external_id: string;
            is_active: boolean;
            /** Format: date-time */
            created_at: string;
            purchase_in_window: {
                /** @enum {string} */
                purchase_level: "Low" | "Medium" | "High";
                /** Format: date-time */
                created_at: string;
            } | null;
            segment_in_window: {
                /** @enum {string} */
                segment_id: "legacy:1.0.0:cluster:0" | "legacy:1.0.0:cluster:1" | "legacy:1.0.0:cluster:2" | "engagement_low" | "engagement_medium" | "engagement_high";
                display_label: string | null;
                /** Format: date-time */
                created_at: string;
            } | null;
        };
        /** @description Approved T12 snapshot response. Cross-field/filter invariants are enforced by SQL/service/runtime DTO validation; see docs/t12_dashboard_api_design.md. */
        DashboardOverview: {
            /** @constant */
            contract_version: "dashboard-snapshot-v1";
            /** Format: date-time */
            generated_at: string;
            /** Format: date-time */
            as_of: string;
            /** @constant */
            source: "application_postgresql_not_research_dataset";
            /** @constant */
            scope: "stored_snapshot_analysis_not_causal_or_future";
            /** @constant */
            purchase_level_source: "stored_model_prediction_not_ground_truth";
            target_thresholds: {
                /** @constant */
                low_inclusive: 10;
                /** @constant */
                medium_inclusive: 15;
            };
            filters: {
                /** Format: date */
                date_from: string;
                /** Format: date */
                date_to: string;
                /** Format: date-time */
                window_start: string;
                /** Format: date-time */
                window_end: string;
                /** @enum {string} */
                timezone: "UTC" | "Asia/Ho_Chi_Minh";
                /** @enum {string} */
                classification_model_version: "1.0.0" | "2.0.0-snapshot-conservative12";
                /** @enum {string} */
                segmentation_model_version: "1.0.0" | "2.0.0-snapshot-k3";
                segment_id: ("legacy:1.0.0:cluster:0" | "legacy:1.0.0:cluster:1" | "legacy:1.0.0:cluster:2" | "engagement_low" | "engagement_medium" | "engagement_high") | null;
            };
            workspace_totals: {
                /** @constant */
                filter_scope: "all_workspace_as_of_not_filtered";
                customers: number;
                active_customers: number;
                behavior_snapshots: number;
                registered_models: number;
            };
            cohort: {
                customers: number;
                /** @constant */
                include_inactive: true;
                /** @enum {string} */
                selection_rule: "all_current_customers" | "latest_linked_segmentation_in_window";
            };
            classification: components["schemas"]["DashboardClassification"];
            segmentation: components["schemas"]["DashboardSegmentation"];
            what_if: {
                scenarios: number;
                scenario_results: number;
                excluded_unlinked_scenarios: number;
                /** @constant */
                filter_scope: "window_and_cohort_not_model_selectors";
                /** @constant */
                integrity: "counts_only_not_verified";
                latest_scenario_at: string | null;
            };
            activity_by_day: components["schemas"]["DashboardDay"][];
            recent_customers: {
                /** @constant */
                selection_rule: "cohort_customer_created_at_desc_id_desc";
                limit: number;
                cohort_total: number;
                items: components["schemas"]["DashboardCustomerPreview"][];
            };
            warnings: ("PARTIAL_CURRENT_DAY" | "UNLINKED_RESULTS_NOT_CUSTOMERS" | "UNLINKED_RESULTS_EXCLUDED_BY_SEGMENT_FILTER" | "UNLINKED_SCENARIOS_EXCLUDED_BY_SEGMENT_FILTER" | "RESEARCH_PERSISTENCE_UNSUPPORTED" | "SEGMENT_LABELS_UNAVAILABLE" | "INFERENCE_MODEL_UNAVAILABLE" | "CURRENT_CUSTOMERS_NOT_HISTORICAL_POPULATION")[];
        };
        /** @enum {string} */
        Auth01Role: "ADMIN" | "OPERATOR" | "VIEWER";
        /** @enum {string} */
        Auth01Capability: "dashboard.read" | "customers.read" | "history.read" | "models.read" | "system.read" | "inference.json.run" | "what_if.preview_compare" | "customers.write" | "snapshots.create" | "inference.csv.run" | "analysis.legacy.save" | "what_if.legacy.save" | "users.manage";
        /** @enum {string} */
        Auth01Status: "ACTIVE" | "DISABLED" | "TEMPORARILY_LOCKED";
        Auth01User: {
            /** Format: uuid */
            id: string;
            username: string;
            display_name: string;
            role: components["schemas"]["Auth01Role"];
            is_active: boolean;
            must_change_password: boolean;
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            updated_at: string;
            row_version: number;
            status: components["schemas"]["Auth01Status"];
            locked_until: string | null;
        };
        Auth01Session: {
            /** Format: date-time */
            idle_expires_at: string;
            /** Format: date-time */
            expires_at: string;
        };
        Auth01Me: {
            user: components["schemas"]["Auth01User"];
            capabilities: components["schemas"]["Auth01Capability"][];
            session: components["schemas"]["Auth01Session"];
        };
        Auth01LoginReply: {
            user: components["schemas"]["Auth01User"];
            capabilities: components["schemas"]["Auth01Capability"][];
            session: components["schemas"]["Auth01Session"];
            csrf_token: string;
        };
        Auth01CsrfReply: {
            csrf_token: string;
            /** @enum {string} */
            state: "preauth" | "authenticated";
            /** Format: date-time */
            expires_at: string;
        };
        Auth01Login: {
            username: string;
            /** @description After NFC:15-128 Unicode code points; non-whitespace; local blocklist applies. Raw512 bound only a precheck. */
            password: string;
        };
        Auth01PasswordChange: {
            /** @description After NFC:15-128 Unicode code points; non-whitespace; local blocklist applies. Raw512 bound only a precheck. */
            current_password: string;
            /** @description After NFC:15-128 Unicode code points; non-whitespace; local blocklist applies. Raw512 bound only a precheck. */
            new_password: string;
        };
        Auth01CreateUser: {
            username: string;
            display_name: string;
            role: components["schemas"]["Auth01Role"];
            /** @description After NFC:15-128 Unicode code points; non-whitespace; local blocklist applies. Raw512 bound only a precheck. */
            initial_password: string;
            /** @description After NFC:15-128 Unicode code points; non-whitespace; local blocklist applies. Raw512 bound only a precheck. */
            admin_password: string;
        };
        Auth01PatchUser: {
            /** @description After NFC:15-128 Unicode code points; non-whitespace; local blocklist applies. Raw512 bound only a precheck. */
            admin_password: string;
            display_name?: string;
            role?: components["schemas"]["Auth01Role"];
            is_active?: boolean;
        } | unknown | unknown | unknown;
        Auth01ResetPassword: {
            /** @description After NFC:15-128 Unicode code points; non-whitespace; local blocklist applies. Raw512 bound only a precheck. */
            admin_password: string;
            /** @description After NFC:15-128 Unicode code points; non-whitespace; local blocklist applies. Raw512 bound only a precheck. */
            initial_password: string;
        };
        Auth01RevokeSessions: {
            /** @description After NFC:15-128 Unicode code points; non-whitespace; local blocklist applies. Raw512 bound only a precheck. */
            admin_password: string;
        };
        Auth01Empty: Record<string, never>;
        Auth01UserList: {
            items: components["schemas"]["Auth01User"][];
            total: number;
            limit: number;
            offset: number;
        };
        Auth01Error: {
            /** @enum {string} */
            code: "ALREADY_AUTHENTICATED" | "AUTH_UNAVAILABLE" | "CSRF_FAILED" | "FORBIDDEN" | "HEADERS_TOO_LARGE" | "INTERNAL_ERROR" | "INVALID_IF_MATCH" | "INVALID_JSON" | "INVALID_REQUEST" | "LAST_ADMIN_PROTECTED" | "ORIGIN_NOT_ALLOWED" | "PASSWORD_CHANGE_REQUIRED" | "PASSWORD_UNCHANGED" | "PAYLOAD_TOO_LARGE" | "PRECONDITION_REQUIRED" | "RATE_LIMITED" | "REAUTH_FAILED" | "REQUEST_TIMEOUT" | "SELF_OPERATION_NOT_ALLOWED" | "SERVER_BUSY" | "STALE_USER_VERSION" | "TARGET_USER_NOT_FOUND" | "UNAUTHORIZED" | "UNSUPPORTED_IDEMPOTENCY_KEY" | "UNSUPPORTED_MEDIA_TYPE" | "USERNAME_UNAVAILABLE" | "VALIDATION_ERROR";
            message: string;
            details: unknown[];
            /** Format: uuid */
            request_id: string;
        };
        Auth01ErrorEnvelope: {
            error: components["schemas"]["Auth01Error"];
        };
    };
    responses: never;
    parameters: {
        /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
        Auth01Csrf: string;
        /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
        Auth01Origin: string;
        /** @description One exact strong AdminUser ETag; missing428, invalid400, stale412. */
        Auth01IfMatch: string;
        /** @description Browser-managed HttpOnly context; login requires unexpired preauth, logout accepts retained context with matching nonce. Not a user Bearer credential. Explicit dev alias mkeai_dev_session. */
        Auth01ContextCookie: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    purchase_level_predict_purchase_level_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PredictionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    segment_predict_segment_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PredictionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    batch_purchase_level_predict_batch_purchase_level_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BatchPredictionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    batch_segment_predict_batch_segment_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BatchPredictionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    csv_purchase_level_predict_csv_purchase_level_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_csv_purchase_level_predict_csv_purchase_level_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    csv_segment_predict_csv_segment_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_csv_segment_predict_csv_segment_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    list_customers_customers_get: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
                include_inactive?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerPage"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    create_customer_customers_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomerCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerRead"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    get_customer_customers__customer_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerRead"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    deactivate_customer_customers__customer_id__delete: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    update_customer_customers__customer_id__patch: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomerUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerRead"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    list_behavior_snapshots_customers__customer_id__behaviors_get: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
            };
            header?: never;
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BehaviorSnapshotPage"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    add_behavior_snapshot_customers__customer_id__behaviors_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BehaviorSnapshotCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BehaviorSnapshotRead"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    list_prediction_history_customers__customer_id__predictions_get: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
            };
            header?: never;
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HistoryPage"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    list_segmentation_history_customers__customer_id__segments_get: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
            };
            header?: never;
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HistoryPage"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    database_health_database_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    health_api_v1_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    ready_api_v1_ready_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadyResponse"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    catalog_api_v1_model_info_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogResponse"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    overview_api_v1_overview_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OverviewResponse"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    segments_api_v1_segments_get: {
        parameters: {
            query?: {
                model_version?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SegmentsResponse"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    purchase_api_v1_predict_purchase_level_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LegacyPurchaseRequest"] | components["schemas"]["T4PurchaseRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PurchaseResponse"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    segment_api_v1_predict_segment_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LegacySegmentRequest"] | components["schemas"]["T5SegmentRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SegmentResponse"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    purchase_batch_api_v1_predict_batch_purchase_level_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LegacyPurchaseBatch"] | components["schemas"]["T4PurchaseBatch"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PurchaseBatchResponse"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    segment_batch_api_v1_predict_batch_segment_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LegacySegmentBatch"] | components["schemas"]["T5SegmentBatch"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SegmentBatchResponse"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    purchase_csv_api_v1_predict_csv_purchase_level_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_purchase_csv_api_v1_predict_csv_purchase_level_post"];
            };
        };
        responses: {
            /** @description UTF-8 BOM CSV; provenance columns include model version */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    segment_csv_api_v1_predict_csv_segment_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_segment_csv_api_v1_predict_csv_segment_post"];
            };
        };
        responses: {
            /** @description Distance is not probability; version-specific segment IDs */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_customers_api_v1_customers_get: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
                include_inactive?: boolean;
                q?: string | null;
                sort?: "created_at" | "external_id";
                direction?: "asc" | "desc";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerPage"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    create_customer_api_v1_customers_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomerCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerRead"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    customer_api_v1_customers__customer_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    /** @description Opaque current customer revision; send via optional If-Match on v1 PATCH/DELETE */
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerRead"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    deactivate_customer_api_v1_customers__customer_id__delete: {
        parameters: {
            query?: never;
            header: {
                /** @description Optional If-Match revision check, not mandatory; legacy route unchanged. */
                "if-match"?: string | null;
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description If-Match did not match current customer revision */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    update_customer_api_v1_customers__customer_id__patch: {
        parameters: {
            query?: never;
            header: {
                /** @description Optional strong ETag from v1 GET; stale value returns412. Omission preserves last-writer-wins compatibility. */
                "if-match"?: string | null;
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomerUpdateV1"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    /** @description Opaque current customer revision; send via optional If-Match on v1 PATCH/DELETE */
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerRead"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description If-Match did not match current customer revision */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    behaviors_api_v1_customers__customer_id__behaviors_get: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
            };
            header?: never;
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BehaviorSnapshotPage"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    add_behavior_api_v1_customers__customer_id__behaviors_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BehaviorCreateV1"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BehaviorSnapshotRead"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    predictions_api_v1_customers__customer_id__predictions_get: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
                model_version?: string | null;
            };
            header?: never;
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PredictionHistoryPageV1"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    customer_segments_api_v1_customers__customer_id__segments_get: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
                model_version?: string | null;
            };
            header?: never;
            path: {
                customer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SegmentHistoryPageV1"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    schema_api_v1_what_if_schema_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WhatIfSchemaResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    preview_api_v1_what_if_preview_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WhatIfPreviewRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WhatIfPreviewResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    compare_api_v1_what_if_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WhatIfCompareRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WhatIfComparisonResponse"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    history_api_v1_what_if_scenarios_get: {
        parameters: {
            query?: {
                customer_id?: string | null;
                classification_model_version?: ("1.0.0" | "2.0.0-snapshot-conservative12") | null;
                offset?: number;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WhatIfHistoryPage"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    save_api_v1_what_if_scenarios_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Required UUIDv4; retry the identical payload with the same key */
                "idempotency-key"?: string | null;
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WhatIfSaveRequest"];
            };
        };
        responses: {
            /** @description Idempotent replay of the stored scenario */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WhatIfSavedScenarioDetail"];
                };
            };
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WhatIfSavedScenarioDetail"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    detail_api_v1_what_if_scenarios__scenario_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                scenario_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WhatIfSavedScenarioDetail"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    dashboard_overview_v1_proposed: {
        parameters: {
            query?: {
                /** @description Inclusive in the selected timezone date. Both dates or neither; default last30 in the selected timezone calendar days including today. */
                date_from?: string;
                /** @description Exclusive in the selected timezone date;1..366days; no later than tomorrow in the selected timezone. Effective data capped at as_of. */
                date_to?: string;
                /** @description Task-scoped catalog version; unknown version404, no fallback/promotion. */
                classification_model_version?: string;
                /** @description Task-scoped catalog version; unknown version404, no fallback/promotion. */
                segmentation_model_version?: string;
                /** @description Optional latest-segmentation-in-window customer cohort; must match selected version namespace or422. */
                segment_id?: string;
                /** @description Bounded preview only, not T13 pagination. */
                table_limit?: number;
                /** @description Calendar timezone for date bounds and daily buckets. Defaults to UTC for existing clients. */
                timezone?: "UTC" | "Asia/Ho_Chi_Minh";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Read-only consistent aggregate; empty history is200, not503. */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardOverview"];
                };
            };
            /** @description INVALID_REQUEST: nonempty GET body unsupported */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Secured profile requires a valid credential */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Secured access denied; no ownership expansion */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description MODEL_VERSION_NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description MODEL_REGISTRY_MISMATCH / MODEL_PERSISTENCE_POLICY_MISMATCH / DASHBOARD_DATA_INTEGRITY_ERROR */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR / INVALID_SEGMENT_FILTER; also unknown or duplicate query */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Existing T10 quota, Retry-After */
            429: {
                headers: {
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Safe INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description DATABASE_UNAVAILABLE / DASHBOARD_QUERY_TIMEOUT; timeout Retry-After1 */
            503: {
                headers: {
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    root__get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    health_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    models_info_models_info_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Accounts authorization */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description Accounts authorization */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_csrf: {
        parameters: {
            query?: never;
            header: {
                /** @description Trusted Origin or same-origin Fetch Metadata required; navigation/cross-site denied. */
                "X-Requested-With": "MK-eAI";
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    /** @description Issue or clear opaque session cookie only as specified; never a JSON session credential. */
                    "Set-Cookie"?: string;
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01CsrfReply"];
                };
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description ORIGIN_NOT_ALLOWED,CSRF_FAILED */
            403: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_login: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie: {
                /** @description Browser-managed HttpOnly context; login requires unexpired preauth, logout accepts retained context with matching nonce. Not a user Bearer credential. Explicit dev alias mkeai_dev_session. */
                "__Host-mkeai_session": components["parameters"]["Auth01ContextCookie"];
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Auth01Login"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    /** @description Issue or clear opaque session cookie only as specified; never a JSON session credential. */
                    "Set-Cookie"?: string;
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01LoginReply"];
                };
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY,INVALID_JSON */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description ORIGIN_NOT_ALLOWED,CSRF_FAILED */
            403: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description REQUEST_TIMEOUT */
            408: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description ALREADY_AUTHENTICATED */
            409: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE */
            413: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE */
            415: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01Me"];
                };
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    /** @description Clear invalid/expired authenticated cookie; never credentials in response JSON. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_logout: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie: {
                /** @description Browser-managed HttpOnly context; login requires unexpired preauth, logout accepts retained context with matching nonce. Not a user Bearer credential. Explicit dev alias mkeai_dev_session. */
                "__Host-mkeai_session": components["parameters"]["Auth01ContextCookie"];
            };
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["Auth01Empty"];
            };
        };
        responses: {
            /** @description Success */
            204: {
                headers: {
                    "Cache-Control"?: "no-store";
                    /** @description Issue or clear opaque session cookie only as specified; never a JSON session credential. */
                    "Set-Cookie"?: string;
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY,INVALID_JSON */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description ORIGIN_NOT_ALLOWED,CSRF_FAILED */
            403: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description REQUEST_TIMEOUT */
            408: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE */
            413: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE */
            415: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_change_password: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Auth01PasswordChange"];
            };
        };
        responses: {
            /** @description Success */
            204: {
                headers: {
                    "Cache-Control"?: "no-store";
                    /** @description Issue or clear opaque session cookie only as specified; never a JSON session credential. */
                    "Set-Cookie"?: string;
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY,INVALID_JSON */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    /** @description Clear invalid/expired authenticated cookie; never credentials in response JSON. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description ORIGIN_NOT_ALLOWED,CSRF_FAILED,REAUTH_FAILED */
            403: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description REQUEST_TIMEOUT */
            408: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE */
            413: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE */
            415: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR,PASSWORD_UNCHANGED */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_list_users: {
        parameters: {
            query?: {
                q?: string;
                role?: components["schemas"]["Auth01Role"];
                status?: components["schemas"]["Auth01Status"];
                sort?: "created_at" | "username";
                direction?: "asc" | "desc";
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01UserList"];
                };
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    /** @description Clear invalid/expired authenticated cookie; never credentials in response JSON. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PASSWORD_CHANGE_REQUIRED,FORBIDDEN */
            403: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_create_user: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Auth01CreateUser"];
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    "Cache-Control"?: "no-store";
                    /** @description Strong AdminUser representation ETag */
                    ETag?: string;
                    /** @description /api/v1/admin/users/{created UUID} */
                    Location?: string;
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01User"];
                };
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY,INVALID_JSON */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    /** @description Clear invalid/expired authenticated cookie; never credentials in response JSON. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PASSWORD_CHANGE_REQUIRED,FORBIDDEN,ORIGIN_NOT_ALLOWED,CSRF_FAILED,REAUTH_FAILED */
            403: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description REQUEST_TIMEOUT */
            408: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description USERNAME_UNAVAILABLE */
            409: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE */
            413: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE */
            415: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_get_user: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    /** @description Strong AdminUser representation ETag */
                    ETag?: string;
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01User"];
                };
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    /** @description Clear invalid/expired authenticated cookie; never credentials in response JSON. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PASSWORD_CHANGE_REQUIRED,FORBIDDEN */
            403: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description TARGET_USER_NOT_FOUND */
            404: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_patch_user: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
                /** @description One exact strong AdminUser ETag; missing428, invalid400, stale412. */
                "If-Match": components["parameters"]["Auth01IfMatch"];
            };
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Auth01PatchUser"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    /** @description Strong AdminUser representation ETag */
                    ETag?: string;
                    /** @description Issue or clear opaque session cookie only as specified; never a JSON session credential. */
                    "Set-Cookie"?: string;
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01User"];
                };
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY,INVALID_JSON,INVALID_IF_MATCH */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    /** @description Clear invalid/expired authenticated cookie; never credentials in response JSON. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PASSWORD_CHANGE_REQUIRED,FORBIDDEN,ORIGIN_NOT_ALLOWED,CSRF_FAILED,REAUTH_FAILED */
            403: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description TARGET_USER_NOT_FOUND */
            404: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description REQUEST_TIMEOUT */
            408: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description SELF_OPERATION_NOT_ALLOWED,LAST_ADMIN_PROTECTED */
            409: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description STALE_USER_VERSION */
            412: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE */
            413: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE */
            415: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PRECONDITION_REQUIRED */
            428: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_reset_password: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
                /** @description One exact strong AdminUser ETag; missing428, invalid400, stale412. */
                "If-Match": components["parameters"]["Auth01IfMatch"];
            };
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Auth01ResetPassword"];
            };
        };
        responses: {
            /** @description Success */
            204: {
                headers: {
                    "Cache-Control"?: "no-store";
                    /** @description Strong AdminUser representation ETag */
                    ETag?: string;
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY,INVALID_JSON,INVALID_IF_MATCH */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    /** @description Clear invalid/expired authenticated cookie; never credentials in response JSON. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PASSWORD_CHANGE_REQUIRED,FORBIDDEN,ORIGIN_NOT_ALLOWED,CSRF_FAILED,REAUTH_FAILED */
            403: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description TARGET_USER_NOT_FOUND */
            404: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description REQUEST_TIMEOUT */
            408: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description SELF_OPERATION_NOT_ALLOWED */
            409: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description STALE_USER_VERSION */
            412: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE */
            413: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE */
            415: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR,PASSWORD_UNCHANGED */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PRECONDITION_REQUIRED */
            428: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
    auth01_revoke_sessions: {
        parameters: {
            query?: never;
            header: {
                /** @description Exact configured trusted origin; null/missing/evil origin rejected, no Referer or CLI bypass. */
                Origin: components["parameters"]["Auth01Origin"];
                /** @description Synchronizer nonce for this cookie context, required for every unsafe request including logout. */
                "X-CSRF-Token": components["parameters"]["Auth01Csrf"];
                /** @description One exact strong AdminUser ETag; missing428, invalid400, stale412. */
                "If-Match": components["parameters"]["Auth01IfMatch"];
            };
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Auth01RevokeSessions"];
            };
        };
        responses: {
            /** @description Success */
            204: {
                headers: {
                    "Cache-Control"?: "no-store";
                    /** @description Strong AdminUser representation ETag */
                    ETag?: string;
                    /** @description Issue or clear opaque session cookie only as specified; never a JSON session credential. */
                    "Set-Cookie"?: string;
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description INVALID_REQUEST,UNSUPPORTED_IDEMPOTENCY_KEY,INVALID_JSON,INVALID_IF_MATCH */
            400: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNAUTHORIZED */
            401: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    /** @description Clear invalid/expired authenticated cookie; never credentials in response JSON. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PASSWORD_CHANGE_REQUIRED,FORBIDDEN,ORIGIN_NOT_ALLOWED,CSRF_FAILED,REAUTH_FAILED */
            403: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description TARGET_USER_NOT_FOUND */
            404: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description REQUEST_TIMEOUT */
            408: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description STALE_USER_VERSION */
            412: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE */
            413: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE */
            415: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description VALIDATION_ERROR */
            422: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description PRECONDITION_REQUIRED */
            428: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description HEADERS_TOO_LARGE */
            431: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
            /** @description AUTH_UNAVAILABLE,SERVER_BUSY */
            503: {
                headers: {
                    /** @description 429 remaining quota window;503 only SERVER_BUSY=1 */
                    "Retry-After"?: number;
                    "Cache-Control"?: "no-store";
                    "X-Security-Profile"?: "accounts";
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auth01ErrorEnvelope"];
                };
            };
        };
    };
}
