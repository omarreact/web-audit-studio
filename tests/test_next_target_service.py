"""Hybrid service Next.js target respects allowed schema and cloud consent."""
from fastapi.testclient import TestClient
from services.analyzer import app as module

client=TestClient(module.app)
PROFILE={'source':{'stack':'React'},'site':{'pageCount':1,'components':{'headings':2,'images':1,'forms':1,'buttons':1}},'pages':[{'title':'Hello','hasScripts':True,'forms':[{}]}], 'secretHTML':'should never leave this browser'}


def test_next_target_profile_bounded():
    data=module.safe_input(PROFILE,'nextjs-static')
    assert data['conversionTarget']=='nextjs-static'
    assert 'secretHTML' not in str(data)
    response=module.rules_only(data)
    assert 'Next.js App Router' in response.summary
    assert any('Forms' in x or 'forms' in x for x in response.risks)
    assert any('client JavaScript' in x for x in response.risks)


def test_next_target_no_unconsented_cloud(monkeypatch):
    async def offline(*args):raise ValueError('Ollama offline')
    async def forbidden(*args):raise AssertionError('Cloud AI called without consent')
    monkeypatch.setattr(module,'local_enrich',offline)
    monkeypatch.setattr(module,'cloud_enrich',forbidden)
    response=client.post('/v1/analyze',json={'targetStack':'nextjs-static','profile':PROFILE,'allowCloud':False})
    assert response.status_code==200
    assert response.json()['mode']=='local-rules'
    assert 'Next.js App Router' in response.json()['enrichment']['summary']


def test_next_target_invalid_input():
    response=client.post('/v1/analyze',json={'targetStack':'nextjs-execute-source','profile':PROFILE})
    assert response.status_code==422
