"""Dynamic scoring decay functions for geo_dynamic challenges.

Mirrors CTFd's own dynamic challenge decay functions (CTFd/plugins/dynamic_challenges/decay.py)
so geo_dynamic challenges score exactly like the built-in "dynamic" type. Kept local because
older CTFd 3.x releases don't ship an importable decay module.
"""
from __future__ import division  # Use floating point for math calculations

import math

from CTFd.models import Solves
from CTFd.utils.modes import get_model


def get_solve_count(challenge):
    Model = get_model()

    solve_count = (
        Solves.query.join(Model, Solves.account_id == Model.id)
        .filter(
            Solves.challenge_id == challenge.id,
            Model.hidden == False,  # noqa: E712
            Model.banned == False,  # noqa: E712
        )
        .count()
    )
    return solve_count


def linear(challenge):
    solve_count = get_solve_count(challenge)

    # The first solver gets the full initial value
    if solve_count != 0:
        solve_count -= 1

    value = challenge.initial - (challenge.decay * solve_count)

    value = math.ceil(value)

    if value < challenge.minimum:
        value = challenge.minimum

    return value


def logarithmic(challenge):
    solve_count = get_solve_count(challenge)

    # The first solver gets the full initial value
    if solve_count != 0:
        solve_count -= 1

    # A decay of 0 would divide by zero
    if challenge.decay == 0:
        challenge.decay = 1

    value = (
        ((challenge.minimum - challenge.initial) / (challenge.decay**2))
        * (solve_count**2)
    ) + challenge.initial

    value = math.ceil(value)

    if value < challenge.minimum:
        value = challenge.minimum

    return value


DECAY_FUNCTIONS = {
    "linear": linear,
    "logarithmic": logarithmic,
}
