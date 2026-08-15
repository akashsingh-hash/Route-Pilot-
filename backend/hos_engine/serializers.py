from rest_framework import serializers


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    current_cycle_used = serializers.FloatField(min_value=0.0, max_value=70.0)

    def validate_current_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("current_location must not be blank.")
        return value.strip()

    def validate_pickup_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("pickup_location must not be blank.")
        return value.strip()

    def validate_dropoff_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("dropoff_location must not be blank.")
        return value.strip()
