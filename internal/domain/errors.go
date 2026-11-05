package domain

import "errors"

var ErrRecordNotFound = errors.New("record not found")

var ErrRecordAlreadyExists = errors.New("record already exists")

var ErrResourceInUse = errors.New("resource is in use")

var ErrSelfDelete = errors.New("cannot delete the current user")

var ErrLastAdmin = errors.New("cannot delete the last active administrator")

// Chain governance errors. They are returned by the store so the HTTP layer can
// map them to distinct problem types without duplicating validation logic.
var ErrStageConflict = errors.New("organization chain stage conflict")

var ErrInvalidStageTransition = errors.New("invalid chain stage transition")

var ErrTerminalStage = errors.New("organization already at the terminal chain stage")
