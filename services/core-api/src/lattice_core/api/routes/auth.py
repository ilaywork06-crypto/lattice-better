from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from lattice_core.api.deps import PublicSvc, Svc
from lattice_core.db.models import User
from lattice_core.domain.permissions import PROPOSABLE_ACTIONS, ROLE_PERMISSIONS
from lattice_core.schemas.users import LoginHint, Me, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def me_view(user: User) -> Me:
    return Me(
        **UserOut.model_validate(user).model_dump(),
        permissions=sorted(ROLE_PERMISSIONS[user.role]),
        proposable_actions=sorted(PROPOSABLE_ACTIONS[user.role]),
    )


@router.post("/token", response_model=TokenOut, summary="Sign in (OAuth2 password flow)")
def sign_in(s: PublicSvc, form: OAuth2PasswordRequestForm = Depends()) -> TokenOut:
    user = s.auth.authenticate(form.username, form.password)
    return TokenOut(access_token=s.auth.issue_token(user), user=me_view(user))


@router.get("/me", response_model=Me, summary="The signed-in user and what they may do")
def me(s: Svc) -> Me:
    return me_view(s.actor)


@router.get("/login-hints", response_model=list[LoginHint],
            summary="Sign-in shortcuts a manager chose to publish (unauthenticated)")
def login_hints(s: PublicSvc) -> list[LoginHint]:
    return [
        LoginHint(full_name=u.full_name, email=u.email, role=u.role,
                  password=u.login_hint_password)
        for u in s.auth.login_hints()
    ]
