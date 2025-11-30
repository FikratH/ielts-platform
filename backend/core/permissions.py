from rest_framework.permissions import BasePermission

class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'student'

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'admin'

class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, 'role', None) == 'teacher'

class IsCurator(BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, 'role', None) == 'curator'

class IsTeacherOrCurator(BasePermission):
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', None)
        return role in ['teacher', 'curator']